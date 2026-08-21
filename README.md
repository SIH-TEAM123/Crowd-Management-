# Person 4 Module: Optimization, Fairness, Priority Handling & Decision Making

## Overview

This module represents **Person 4's** scope in the **SOA Ideathon 2026 project (Problem Statement S39: AI-Based Queue, Crowd & Service Experience Optimization)**.

### Responsibilities
- Optimization
- Fairness evaluation
- Priority handling
- What-if scenario simulation
- Resource allocation
- Decision making & ranking
- Explainable recommendation generation

---

## Module Architecture & Boundaries

The project follows a multi-person pipeline architecture:

```text
PERSON 1 (User/Token/Appointment)
  └─► PERSON 2 (Queue & Crowd Management)
        └─► PERSON 3 (AI Prediction)
              └─► PERSON 4 (Optimization, Fairness & Decision Making)
                    └─► PERSON 5 (Backend/API & Integration)
                          └─► PERSON 6 (Frontend/Dashboard & UX)
```

**Person 4 Boundary:**
- **Inputs received from Person 3 (AI Prediction) / Person 2 (Queue Data)**: Current queue/service states, predicted wait times, arrival rates, congestion risk, resource pools, and priority classifications.
- **Outputs delivered to Person 5 (Backend/Integration)**: Evaluated actions, selected best action recommendation, predicted impact metrics, fairness scores, resource allocations, alternative scenarios, and natural-language explanations.

---

## Folder & File Structure

```text
person4/
│
├── __init__.py                # Package root docstring and export definitions
├── main.py                    # Single execution entry point interface for Person 4
│
├── models/
│   ├── __init__.py            # Models subpackage init
│   ├── input_models.py        # Pydantic schemas for input state & predictions
│   └── output_models.py       # Pydantic schemas for recommended decisions & analysis
│
├── optimizer/
│   ├── __init__.py            # Optimizer subpackage init
│   ├── scenario_generator.py  # Generates feasible what-if candidate actions
│   ├── simulator.py           # Simulates/estimates action outcomes on queue metrics
│   ├── fairness.py            # Enforces fairness constraints & starvation checks
│   ├── optimizer.py           # Scores scenarios against multi-objective functions
│   └── decision_engine.py     # Ranks scenarios & selects explainable recommendation
│
├── tests/
│   ├── __init__.py            # Test suite package init
│   ├── test_models.py         # Unit tests for input/output schemas
│   ├── test_scenarios.py      # Unit tests for scenario generation logic
│   ├── test_simulator.py      # Unit tests for outcome simulator
│   ├── test_fairness.py       # Unit tests for fairness & priority rules
│   ├── test_optimizer.py      # Unit tests for multi-objective scoring
│   └── test_decision_engine.py# Unit tests for candidate ranking & recommendation selection
│
└── README.md                  # Module documentation & boundaries
```

---

## Component Descriptions

1. **`person4/main.py`**:
   - Primary interface function that will take validated input payloads and return optimized recommendations.

2. **`person4/models/input_models.py`**:
   - Schema definitions for operational queue state, current capacities, predicted wait time, predicted demand, available resources, and priority metadata.

3. **`person4/models/output_models.py`**:
   - Schema definitions for recommendation results, predicted operational impacts, fairness evaluations, scenario alternatives, and explanations.

4. **`person4/optimizer/scenario_generator.py`**:
   - Generates candidate what-if actions (`NO_ACTION`, `OPEN_COUNTER`, `REALLOCATE_RESOURCE`, `PRIORITY_ADJUSTMENT`) subject to resource constraints.

5. **`person4/optimizer/simulator.py`**:
   - Deterministic outcome estimation for candidate actions (queue length changes, wait time reduction, utilization changes, resource costs).

6. **`person4/optimizer/fairness.py`**:
   - Enforces equity rules, verifies priority limits, and prevents standard queue starvation.

7. **`person4/optimizer/optimizer.py`**:
   - Multi-objective scoring balancing wait times, congestion risks, resource costs, and fairness metrics.

8. **`person4/optimizer/decision_engine.py`**:
   - Scenario filtering, ranking, top action selection, and natural language explanation generation.

9. **`person4/tests/`**:
   - Isolated unit testing suite structured for test-driven development (TDD).

---

## Integration Plan

- **Person 3 Integration**: Person 3 will pass prediction payloads directly matching models in `person4/models/input_models.py`.
- **Person 5 Integration**: Person 5 (FastAPI Backend) will invoke `person4/main.py` or import models from `person4.models` to serve API endpoints.
