package main

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockTransactionContext is a mock of the contractapi.TransactionContextInterface
type MockTransactionContext struct {
	contractapi.TransactionContextInterface
	stub *MockChaincodeStub
}

func (m *MockTransactionContext) GetStub() shim.ChaincodeStubInterface {
	return m.stub
}

// MockChaincodeStub is a mock of the shim.ChaincodeStubInterface
type MockChaincodeStub struct {
	shim.ChaincodeStubInterface
	mock.Mock
	state map[string][]byte
}

func (m *MockChaincodeStub) PutState(key string, value []byte) error {
	m.state[key] = value
	return nil
}

func (m *MockChaincodeStub) GetState(key string) ([]byte, error) {
	if val, ok := m.state[key]; ok {
		return val, nil
	}
	return nil, nil
}

func TestCreateBatch(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}

	sc := &SmartContract{}

	err := sc.CreateBatch(ctx, "BATCH01", "VaccineX", "Pfizer")
	assert.NoError(t, err)

	val, _ := stub.GetState("BATCH01")
	var batch Batch
	json.Unmarshal(val, &batch)

	assert.Equal(t, "BATCH01", batch.ID)
	assert.Equal(t, "VaccineX", batch.DrugName)
	assert.Equal(t, "Pfizer", batch.Manufacturer)
	assert.Equal(t, "Pfizer", batch.CurrentOwner)
	assert.Equal(t, false, batch.ExcursionAlert)
	assert.Equal(t, "Manufactured", batch.Status)
}

func TestTransferCustody(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	sc.CreateBatch(ctx, "BATCH01", "VaccineX", "Pfizer")

	err := sc.TransferCustody(ctx, "BATCH01", "DistributorA", "InTransit")
	assert.NoError(t, err)

	val, _ := stub.GetState("BATCH01")
	var batch Batch
	json.Unmarshal(val, &batch)

	assert.Equal(t, "DistributorA", batch.CurrentOwner)
	assert.Equal(t, "InTransit", batch.Status)
}

func TestLogTemperatureAndExcursion(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	sc.CreateBatch(ctx, "BATCH01", "VaccineX", "Pfizer")

	// Normal temp
	err := sc.LogTemperature(ctx, "BATCH01", "2023-10-01T10:00:00Z", 5.0, "Sensor01")
	assert.NoError(t, err)

	val, _ := stub.GetState("BATCH01")
	var batch Batch
	json.Unmarshal(val, &batch)
	assert.Equal(t, 1, len(batch.TemperatureLogs))
	assert.Equal(t, false, batch.ExcursionAlert)

	// High temp excursion
	err = sc.LogTemperature(ctx, "BATCH01", "2023-10-01T11:00:00Z", 9.5, "Sensor01")
	assert.NoError(t, err)

	val, _ = stub.GetState("BATCH01")
	json.Unmarshal(val, &batch)
	assert.Equal(t, 2, len(batch.TemperatureLogs))
	assert.Equal(t, true, batch.ExcursionAlert)
}

func TestQueryBatch(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	// Query non-existent
	_, err := sc.QueryBatch(ctx, "BATCH99")
	assert.Error(t, err)
	assert.Equal(t, fmt.Errorf("the batch BATCH99 does not exist"), err)

	// Query existing
	sc.CreateBatch(ctx, "BATCH01", "VaccineX", "Pfizer")
	batch, err := sc.QueryBatch(ctx, "BATCH01")
	assert.NoError(t, err)
	assert.Equal(t, "BATCH01", batch.ID)
}
