# --------------------------------------------------
# Prediction confidence
# --------------------------------------------------

MODEL_R2 = 0.6703


def predict_confidence():
    """
    Return the confidence estimate based on the
    validated V3 model R² score.

    Returns:
        float: confidence percentage
    """

    confidence = MODEL_R2 * 100

    return round(confidence, 2)


# --------------------------------------------------
# Simple test
# --------------------------------------------------

if __name__ == "__main__":

    confidence = predict_confidence()

    print("\n===== PREDICTION CONFIDENCE =====")
    print(f"Prediction confidence: {confidence:.2f}%")