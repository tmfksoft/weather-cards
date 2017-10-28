# API Endpoints
Find below a list of the different served endpoints and their parameters and responses.
All API Endpooints only take parameters as query parameters!

All API endpoints deploy ratelimiting, you may only request data from the entire application 50 times within one minute.
This ratelimit covers all endpoints at once rather than individually.

## Weather Cards
*Responds with a pre-rendered weather card otherwise JSON*

Endpoint: /v1/card

| Parameter | Type   | Example      |
|-----------|--------|--------------|
| Location  | String | Ilkeston, UK |

#### Successful Response
[insert image]

#### Unsuccessful Response
```json
{
"statusCode": 404,
"error": "Not Found",
"message": "Location not found."
}
```

## Weather
*Responds with a weather information retrieved and cached from OpenWeatherMap*

Endpoint: /v1/weather

| Parameter | Type   | Example      |
|-----------|--------|--------------|
| Location  | String | Ilkeston, UK |

#### Successful Response
```json
{
"coord": {
"lon": -1.31,
"lat": 52.97
},
"weather": [
{
"id": 803,
"main": "Clouds",
"description": "broken clouds",
"icon": "04n"
}
],
"base": "stations",
"main": {
"temp": 287.15,
"pressure": 1018,
"humidity": 87,
"temp_min": 287.15,
"temp_max": 287.15
},
"visibility": 10000,
"wind": {
"speed": 9.3,
"deg": 280
},
"clouds": {
"all": 75
},
"dt": 1509227400,
"sys": {
"type": 1,
"id": 5106,
"message": 0.0053,
"country": "GB",
"sunrise": 1509173834,
"sunset": 1509208787
},
"id": 2646274,
"name": "Ilkeston",
"cod": 200
}
```

#### Unsuccessful Response
```json
{
"statusCode": 404,
"error": "Not Found",
"message": "Location not found."
}
```
