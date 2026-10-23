package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing a ColdChainRx Batch
type SmartContract struct {
	contractapi.Contract
}

// Batch describes the details of a pharmaceutical batch
type Batch struct {
	ID              string           `json:"id"`
	DrugName        string           `json:"drugName"`
	Manufacturer    string           `json:"manufacturer"`
	CurrentOwner    string           `json:"currentOwner"`
	TemperatureLogs []TemperatureLog `json:"temperatureLogs"`
	ExcursionAlert  bool             `json:"excursionAlert"`
	Status          string           `json:"status"` // e.g., "Manufactured", "InTransit", "Delivered"
}

// TemperatureLog represents a single temperature reading from an IoT sensor
type TemperatureLog struct {
	Timestamp   string  `json:"timestamp"`
	Temperature float64 `json:"temperature"`
	Reporter    string  `json:"reporter"`
}

// HistoryQueryResult represents a historical state of a batch
type HistoryQueryResult struct {
	TxId      string `json:"txId"`
	Timestamp string `json:"timestamp"`
	IsDelete  bool   `json:"isDelete"`
	Record    *Batch `json:"record"`
}

// PaginatedHistoryResult represents paginated historical states of a batch
type PaginatedHistoryResult struct {
	Records      []HistoryQueryResult `json:"records"`
	TotalRecords int                  `json:"totalRecords"`
	Page         int                  `json:"page"`
	PageSize     int                  `json:"pageSize"`
	TotalPages   int                  `json:"totalPages"`
	HasMore      bool                 `json:"hasMore"`
}

const ExcursionThresholdHigh = 8.0
const ExcursionThresholdLow = 2.0

// CreateBatch initializes a new batch in the ledger
func (s *SmartContract) CreateBatch(ctx contractapi.TransactionContextInterface, id string, drugName string, manufacturer string) error {
	exists, err := s.BatchExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the batch %s already exists", id)
	}

	batch := Batch{
		ID:              id,
		DrugName:        drugName,
		Manufacturer:    manufacturer,
		CurrentOwner:    manufacturer, // Initially owned by manufacturer
		TemperatureLogs: []TemperatureLog{},
		ExcursionAlert:  false,
		Status:          "Manufactured",
	}

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, batchJSON)
}

// QueryBatch returns the batch stored in the world state with given id
func (s *SmartContract) QueryBatch(ctx contractapi.TransactionContextInterface, id string) (*Batch, error) {
	batchJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if batchJSON == nil {
		return nil, fmt.Errorf("the batch %s does not exist", id)
	}

	var batch Batch
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return nil, err
	}

	return &batch, nil
}

// TransferCustody changes the owner of a batch
func (s *SmartContract) TransferCustody(ctx contractapi.TransactionContextInterface, id string, newOwner string, newStatus string) error {
	batch, err := s.QueryBatch(ctx, id)
	if err != nil {
		return err
	}

	batch.CurrentOwner = newOwner
	batch.Status = newStatus

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, batchJSON)
}

// LogTemperature appends a temperature reading to the batch and flags excursions
func (s *SmartContract) LogTemperature(ctx contractapi.TransactionContextInterface, id string, timestamp string, temperature float64, reporter string) error {
	batch, err := s.QueryBatch(ctx, id)
	if err != nil {
		return err
	}

	logEntry := TemperatureLog{
		Timestamp:   timestamp,
		Temperature: temperature,
		Reporter:    reporter,
	}

	batch.TemperatureLogs = append(batch.TemperatureLogs, logEntry)

	// Check for temperature excursion (e.g., must be between 2C and 8C)
	if temperature > ExcursionThresholdHigh || temperature < ExcursionThresholdLow {
		batch.ExcursionAlert = true
	}

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, batchJSON)
}

func (s *SmartContract) fetchHistoryRecords(ctx contractapi.TransactionContextInterface, id string) ([]HistoryQueryResult, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(id)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var batch Batch
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &batch)
			if err != nil {
				return nil, err
			}
			// Optimization: Prevent exponential O(N^2) payload explosion.
			// Historical revisions accumulate previous logs. For history auditing,
			// each revision only needs the reading recorded in that specific transaction.
			if len(batch.TemperatureLogs) > 1 {
				batch.TemperatureLogs = []TemperatureLog{
					batch.TemperatureLogs[len(batch.TemperatureLogs)-1],
				}
			}
		}

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: response.Timestamp.String(),
			IsDelete:  response.IsDelete,
			Record:    &batch,
		}
		records = append(records, record)
	}

	return records, nil
}

// GetBatchHistoryPaginated retrieves paginated historical state changes (newest first)
func (s *SmartContract) GetBatchHistoryPaginated(ctx contractapi.TransactionContextInterface, id string, pageSize int, page int) (*PaginatedHistoryResult, error) {
	allRecords, err := s.fetchHistoryRecords(ctx, id)
	if err != nil {
		return nil, err
	}

	totalRecords := len(allRecords)
	if pageSize <= 0 {
		pageSize = 50
	}
	if page <= 0 {
		page = 1
	}

	// Reverse chronological order: newest transactions first
	// (so page 1 always contains the most recent changes)
	reversed := make([]HistoryQueryResult, totalRecords)
	for i, r := range allRecords {
		reversed[totalRecords-1-i] = r
	}

	totalPages := 0
	if totalRecords > 0 {
		totalPages = (totalRecords + pageSize - 1) / pageSize
	}

	startIndex := (page - 1) * pageSize
	if startIndex < 0 {
		startIndex = 0
	}

	var paginatedRecords []HistoryQueryResult
	if startIndex < totalRecords {
		endIndex := startIndex + pageSize
		if endIndex > totalRecords {
			endIndex = totalRecords
		}
		paginatedRecords = reversed[startIndex:endIndex]
	} else {
		paginatedRecords = []HistoryQueryResult{}
	}

	hasMore := page < totalPages

	return &PaginatedHistoryResult{
		Records:      paginatedRecords,
		TotalRecords: totalRecords,
		Page:         page,
		PageSize:     pageSize,
		TotalPages:   totalPages,
		HasMore:      hasMore,
	}, nil
}

// GetBatchHistory retrieves the provenance (history) of the batch.
// Defaults to the most recent 50 records in reverse chronological order to prevent gRPC message size exhaustion.
func (s *SmartContract) GetBatchHistory(ctx contractapi.TransactionContextInterface, id string) ([]HistoryQueryResult, error) {
	paginated, err := s.GetBatchHistoryPaginated(ctx, id, 50, 1)
	if err != nil {
		return nil, err
	}
	return paginated.Records, nil
}

// BatchExists returns true when batch with given ID exists in world state
func (s *SmartContract) BatchExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	batchJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}
	return batchJSON != nil, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating ColdChainRx chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting ColdChainRx chaincode: %v", err)
	}
}
