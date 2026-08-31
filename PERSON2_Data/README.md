# Person 2 — Data Preprocessing Module

## Purpose

This module prepares queue and call-centre data for the machine learning and analytics stages of the crowd-management project.

The module performs:

1. Data loading
2. Data cleaning
3. Feature engineering
4. Dataset validation
5. ML feature selection
6. Train/test splitting

---

# 1. Project Structure

```text
PERSON2_Data/
│
├── data/
│   ├── raw/
│   │   └── ml_training_data_v2.csv
│   │
│   └── processed/
│       ├── processed_ml_data.csv
│       ├── X_train.csv
│       ├── X_test.csv
│       ├── y_train.csv
│       └── y_test.csv
│
├── test_data/
│   ├── crowd_data.csv
│   └── processed_crowd_data.csv
│
├── data_loader.py
├── cleaner.py
├── feature_engineering.py
├── preprocessor.py
├── validator.py
├── ml_dataset.py
├── dataset_splitter.py
├── person3_handoff.md
└── README.md