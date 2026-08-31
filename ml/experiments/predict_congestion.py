# --------------------------------------------------
# Congestion level prediction
# --------------------------------------------------

def predict_congestion_level(predicted_queue_length):
    """
    Classify congestion based on predicted queue length.

    Returns:
        LOW
        MEDIUM
        HIGH
        CRITICAL
    """

    if predicted_queue_length < 5:
        return "LOW"

    elif predicted_queue_length < 15:
        return "MEDIUM"

    elif predicted_queue_length < 30:
        return "HIGH"

    else:
        return "CRITICAL"


# --------------------------------------------------
# Simple test
# --------------------------------------------------

if __name__ == "__main__":

    predicted_queue = 11.20

    congestion = predict_congestion_level(predicted_queue)

    print("\n===== CONGESTION PREDICTION =====")
    print(f"Predicted queue length: {predicted_queue:.2f} callers")
    print(f"Congestion level: {congestion}")
    