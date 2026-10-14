import json
import requests
import paho.mqtt.client as mqtt


# ============================================================
# MQTT CONFIGURATION
# ============================================================

MQTT_BROKER = "10.144.57.235"
MQTT_PORT = 1883
MQTT_TOPIC = "medical/sensor/data"


# ============================================================
# FABRIC BACKEND CONFIGURATION
# ============================================================

BACKEND_URL = "http://10.144.57.204:5000/api/iot/temperature"

# Maximum time to wait for the backend
BACKEND_TIMEOUT = 10


# ============================================================
# MEDICAL TEMPERATURE LIMITS
# ============================================================

MIN_TEMP = 2.0
MAX_TEMP = 8.0


# ============================================================
# SENSOR PHYSICAL VALIDATION LIMITS
# ============================================================

MIN_PHYSICAL_TEMP = -40.0
MAX_PHYSICAL_TEMP = 80.0

MIN_HUMIDITY = 0.0
MAX_HUMIDITY = 100.0


# ============================================================
# VALIDATE SENSOR DATA
# ============================================================

def validate_sensor_data(data):

    print("\nValidating sensor data...")

    # --------------------------------------------------------
    # 1. Check required fields
    # --------------------------------------------------------

    required_fields = [
        "sensor_id",
        "temperature",
        "humidity",
        "min_temp",
        "max_temp",
        "timestamp",
        "status"
    ]

    for field in required_fields:

        if field not in data:

            print(
                f"VALIDATION FAILED: Missing field '{field}'"
            )

            return False


    # --------------------------------------------------------
    # 2. Validate sensor ID
    # --------------------------------------------------------

    if not isinstance(data["sensor_id"], str):

        print(
            "VALIDATION FAILED: Invalid sensor_id"
        )

        return False


    # --------------------------------------------------------
    # 3. Check sensor fault
    # --------------------------------------------------------

    if data["status"] == "SENSOR_FAULT":

        print(
            "VALIDATION WARNING: Sensor fault received"
        )

        print(
            "Gateway will NOT send invalid sensor data to Fabric."
        )

        return False


    # --------------------------------------------------------
    # 4. Check temperature is not NULL
    # --------------------------------------------------------

    temperature = data["temperature"]

    if temperature is None:

        print(
            "VALIDATION FAILED: Temperature is null"
        )

        return False


    # --------------------------------------------------------
    # 5. Check temperature is numeric
    # --------------------------------------------------------

    if not isinstance(temperature, (int, float)):

        print(
            "VALIDATION FAILED: Temperature is not numeric"
        )

        return False


    # --------------------------------------------------------
    # 6. Check physically valid temperature
    # --------------------------------------------------------

    if (
        temperature < MIN_PHYSICAL_TEMP
        or
        temperature > MAX_PHYSICAL_TEMP
    ):

        print(
            "VALIDATION FAILED: Temperature is physically invalid"
        )

        print(
            f"Allowed physical range: "
            f"{MIN_PHYSICAL_TEMP}°C to {MAX_PHYSICAL_TEMP}°C"
        )

        return False


    # --------------------------------------------------------
    # 7. Check humidity is not NULL
    # --------------------------------------------------------

    humidity = data["humidity"]

    if humidity is None:

        print(
            "VALIDATION FAILED: Humidity is null"
        )

        return False


    # --------------------------------------------------------
    # 8. Check humidity is numeric
    # --------------------------------------------------------

    if not isinstance(humidity, (int, float)):

        print(
            "VALIDATION FAILED: Humidity is not numeric"
        )

        return False


    # --------------------------------------------------------
    # 9. Check humidity range
    # --------------------------------------------------------

    if (
        humidity < MIN_HUMIDITY
        or
        humidity > MAX_HUMIDITY
    ):

        print(
            "VALIDATION FAILED: Humidity outside 0-100%"
        )

        return False


    # --------------------------------------------------------
    # 10. Check medical temperature range
    # --------------------------------------------------------

    if (
        temperature < MIN_TEMP
        or
        temperature > MAX_TEMP
    ):

        print(
            "VALIDATION RESULT: TEMPERATURE EXCURSION"
        )

    else:

        print(
            "VALIDATION RESULT: TEMPERATURE NORMAL"
        )


    # --------------------------------------------------------
    # 11. Validation successful
    # --------------------------------------------------------

    print(
        "VALIDATION PASSED"
    )

    return True


# ============================================================
# SEND VALID DATA TO FABRIC BACKEND
# ============================================================

def send_to_fabric_backend(data):

    print("\n------------------------------------------------")
    print("SENDING DATA TO FABRIC BACKEND")
    print("------------------------------------------------")

    # --------------------------------------------------------
    # Prepare payload for backend
    # --------------------------------------------------------

    payload = {
        "sensor_id": data["sensor_id"],
        "temperature": data["temperature"],
        "humidity": data["humidity"],
        "timestamp": data["timestamp"],
        "status": data["status"]
    }

    print(
        "Backend URL:",
        BACKEND_URL
    )

    print(
        "\nPayload being sent:"
    )

    print(
        json.dumps(
            payload,
            indent=4
        )
    )


    # --------------------------------------------------------
    # Send HTTP POST request
    # --------------------------------------------------------

    try:

        response = requests.post(
            BACKEND_URL,
            json=payload,
            headers={
                "Content-Type": "application/json"
            },
            timeout=BACKEND_TIMEOUT
        )


    except requests.exceptions.Timeout:

        print(
            "\nFABRIC SUBMISSION FAILED:"
        )

        print(
            "Backend request timed out."
        )

        return False


    except requests.exceptions.ConnectionError:

        print(
            "\nFABRIC SUBMISSION FAILED:"
        )

        print(
            "Could not connect to the Fabric backend."
        )

        print(
            "Check whether the backend is running."
        )

        return False


    except requests.exceptions.RequestException as e:

        print(
            "\nFABRIC SUBMISSION FAILED:"
        )

        print(
            "HTTP request error:",
            e
        )

        return False


    # --------------------------------------------------------
    # Display HTTP response
    # --------------------------------------------------------

    print(
        "\nBackend HTTP status:",
        response.status_code
    )

    print(
        "Backend response:"
    )

    print(
        response.text
    )


    # --------------------------------------------------------
    # Check successful response
    # --------------------------------------------------------

    if response.status_code == 200:

        print(
            "\n>>> FABRIC SUBMISSION SUCCESSFUL"
        )

        try:

            result = response.json()

            print(
                "\nBlockchain response:"
            )

            print(
                json.dumps(
                    result,
                    indent=4
                )
            )

        except ValueError:

            print(
                "Warning: Backend response was not JSON."
            )

        return True


    # --------------------------------------------------------
    # Handle bad request
    # --------------------------------------------------------

    elif response.status_code == 400:

        print(
            "\n>>> FABRIC SUBMISSION REJECTED"
        )

        print(
            "Backend rejected the submitted data."
        )

        return False


    # --------------------------------------------------------
    # Handle server/Fabric error
    # --------------------------------------------------------

    elif response.status_code >= 500:

        print(
            "\n>>> FABRIC/BACKEND ERROR"
        )

        print(
            "The backend or Fabric transaction failed."
        )

        return False


    # --------------------------------------------------------
    # Handle other HTTP responses
    # --------------------------------------------------------

    else:

        print(
            "\n>>> UNEXPECTED BACKEND RESPONSE"
        )

        return False


# ============================================================
# MQTT MESSAGE RECEIVED
# ============================================================

def on_message(client, userdata, msg):

    print("\n================================================")
    print("MQTT MESSAGE RECEIVED")
    print("================================================")

    print(
        "Topic:",
        msg.topic
    )

    raw_message = msg.payload.decode()

    print(
        "Raw message:",
        raw_message
    )


    # --------------------------------------------------------
    # Convert JSON message
    # --------------------------------------------------------

    try:

        data = json.loads(
            raw_message
        )

    except json.JSONDecodeError:

        print(
            "\nVALIDATION FAILED: Invalid JSON"
        )

        print(
            ">>> Gateway rejected the sensor reading."
        )

        return


    # --------------------------------------------------------
    # Display parsed data
    # --------------------------------------------------------

    print("\nParsed sensor data:")

    print(
        json.dumps(
            data,
            indent=4
        )
    )


    # --------------------------------------------------------
    # Validate data
    # --------------------------------------------------------

    is_valid = validate_sensor_data(data)


    # --------------------------------------------------------
    # Process valid data
    # --------------------------------------------------------

    if is_valid:

        print(
            "\n>>> Gateway accepted the sensor reading."
        )

        # ----------------------------------------------------
        # Send valid reading to Fabric backend
        # ----------------------------------------------------

        fabric_success = send_to_fabric_backend(data)


        if fabric_success:

            print(
                "\n>>> Gateway → Backend → Fabric: SUCCESS"
            )

        else:

            print(
                "\n>>> Gateway → Backend → Fabric: FAILED"
            )


    # --------------------------------------------------------
    # Reject invalid data
    # --------------------------------------------------------

    else:

        print(
            "\n>>> Gateway rejected the sensor reading."
        )

        print(
            ">>> Invalid data will NOT be sent to Fabric."
        )


# ============================================================
# MQTT CONNECTED
# ============================================================

def on_connect(client, userdata, flags, rc):

    if rc == 0:

        print(
            "\nMQTT Gateway connected to broker."
        )

        print(
            "Subscribing to:",
            MQTT_TOPIC
        )

        client.subscribe(
            MQTT_TOPIC
        )

        print(
            "Gateway is waiting for sensor data..."
        )

    else:

        print(
            "MQTT connection failed."
        )

        print(
            "Return code:",
            rc
        )


# ============================================================
# MQTT DISCONNECTED
# ============================================================

def on_disconnect(client, userdata, rc):

    print(
        "\nMQTT Gateway disconnected from broker."
    )

    print(
        "Disconnect code:",
        rc
    )


# ============================================================
# MAIN PROGRAM
# ============================================================

def main():

    print("================================================")
    print("MEDICAL TEMPERATURE MQTT GATEWAY")
    print("================================================")

    print(
        "MQTT Broker:",
        MQTT_BROKER
    )

    print(
        "MQTT Port:",
        MQTT_PORT
    )

    print(
        "MQTT Topic:",
        MQTT_TOPIC
    )

    print(
        "Fabric Backend:",
        BACKEND_URL
    )

    print(
        f"Medical temperature range: "
        f"{MIN_TEMP}°C - {MAX_TEMP}°C"
    )

    print(
        f"Physical temperature range: "
        f"{MIN_PHYSICAL_TEMP}°C - {MAX_PHYSICAL_TEMP}°C"
    )


    # --------------------------------------------------------
    # Create MQTT client
    # --------------------------------------------------------

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION1,
        client_id="MEDICAL_GATEWAY_01"
    )


    # --------------------------------------------------------
    # Assign callbacks
    # --------------------------------------------------------

    client.on_connect = on_connect

    client.on_message = on_message

    client.on_disconnect = on_disconnect


    # --------------------------------------------------------
    # Connect to MQTT broker
    # --------------------------------------------------------

    print(
        "\nConnecting to MQTT broker..."
    )

    try:

        client.connect(
            MQTT_BROKER,
            MQTT_PORT,
            60
        )

    except Exception as e:

        print(
            "\nERROR: Could not connect to MQTT broker."
        )

        print(
            "Reason:",
            e
        )

        return


    # --------------------------------------------------------
    # Start MQTT network loop
    # --------------------------------------------------------

    try:

        client.loop_forever()

    except KeyboardInterrupt:

        print(
            "\n\nGateway stopped by user."
        )

        client.disconnect()


# ============================================================
# PROGRAM ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()