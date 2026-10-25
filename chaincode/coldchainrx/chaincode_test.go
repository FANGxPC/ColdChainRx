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

func TestAssignAndGetDeviceAssignment(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	sc.CreateBatch(ctx, "BATCH_COVID", "Moderna", "Moderna Inc")

	// Assign BOX001 to BATCH_COVID
	err := sc.AssignDeviceToBatch(ctx, "BOX001", "BATCH_COVID", "2026-10-25T10:00:00Z")
	assert.NoError(t, err)

	// Verify device assignment mapping
	assignment, err := sc.GetDeviceAssignment(ctx, "BOX001")
	assert.NoError(t, err)
	assert.Equal(t, "BOX001", assignment.DeviceID)
	assert.Equal(t, "BATCH_COVID", assignment.BatchID)
	assert.Equal(t, true, assignment.Active)

	// Verify batch record has assigned device
	batch, err := sc.QueryBatch(ctx, "BATCH_COVID")
	assert.NoError(t, err)
	assert.Equal(t, "BOX001", batch.AssignedDevice)
}

func TestLogTelemetryWithHumidityAndCustomThresholds(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	// Ultra-low mRNA vaccine: -80C to -60C
	err := sc.CreateBatchWithThresholds(ctx, "BATCH_MRA", "mRNA-1273", "BioNTech", -80.0, -60.0)
	assert.NoError(t, err)

	// Safe temperature (-72C) and 85% humidity
	err = sc.LogTelemetry(ctx, "BATCH_MRA", "2026-10-25T11:00:00Z", -72.0, 85.0, "Sensor_Omkar_01")
	assert.NoError(t, err)

	batch, err := sc.QueryBatch(ctx, "BATCH_MRA")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(batch.TemperatureLogs))
	assert.Equal(t, -72.0, batch.TemperatureLogs[0].Temperature)
	assert.Equal(t, 85.0, batch.TemperatureLogs[0].Humidity)
	assert.Equal(t, false, batch.ExcursionAlert)

	// Excursion: -55C is above max allowed -60C
	err = sc.LogTelemetry(ctx, "BATCH_MRA", "2026-10-25T11:15:00Z", -55.0, 90.0, "Sensor_Omkar_01")
	assert.NoError(t, err)

	batch, err = sc.QueryBatch(ctx, "BATCH_MRA")
	assert.NoError(t, err)
	assert.Equal(t, 2, len(batch.TemperatureLogs))
	assert.Equal(t, true, batch.ExcursionAlert)
}

func TestLogDeviceTelemetry(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	sc.CreateBatch(ctx, "BATCH_RESOLVE", "FluShot", "Sanofi")
	sc.AssignDeviceToBatch(ctx, "BOX99", "BATCH_RESOLVE", "2026-10-25T10:00:00Z")

	// Device BOX99 logs telemetry directly without passing batch ID
	err := sc.LogDeviceTelemetry(ctx, "BOX99", "2026-10-25T12:00:00Z", 4.2, 58.0)
	assert.NoError(t, err)

	batch, err := sc.QueryBatch(ctx, "BATCH_RESOLVE")
	assert.NoError(t, err)
	assert.Equal(t, 1, len(batch.TemperatureLogs))
	assert.Equal(t, 4.2, batch.TemperatureLogs[0].Temperature)
	assert.Equal(t, 58.0, batch.TemperatureLogs[0].Humidity)
	assert.Equal(t, "BOX99", batch.TemperatureLogs[0].Reporter)
}

func TestUnassignDevice(t *testing.T) {
	stub := &MockChaincodeStub{state: make(map[string][]byte)}
	ctx := &MockTransactionContext{stub: stub}
	sc := &SmartContract{}

	sc.CreateBatch(ctx, "BATCH_TEMP", "DrugX", "Pharma")
	sc.AssignDeviceToBatch(ctx, "BOX_RELEASE", "BATCH_TEMP", "2026-10-25T10:00:00Z")

	err := sc.UnassignDevice(ctx, "BOX_RELEASE")
	assert.NoError(t, err)

	assignment, err := sc.GetDeviceAssignment(ctx, "BOX_RELEASE")
	assert.NoError(t, err)
	assert.Equal(t, false, assignment.Active)

	// Logging with unassigned device should now fail
	err = sc.LogDeviceTelemetry(ctx, "BOX_RELEASE", "2026-10-25T13:00:00Z", 5.0, 50.0)
	assert.Error(t, err)
}
