from pydantic import BaseModel, ConfigDict


class HospitalResponse(BaseModel):

    hospital_id: str
    name: str
    address: str
    latitude: float
    longitude: float

    model_config = ConfigDict(
        from_attributes=True
    )