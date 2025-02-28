# API Documentation

This document provides information about all available API endpoints in the Home Energy Monitoring application.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
   - [Sign Up](#sign-up)
   - [Login](#login)
2. [User Data Endpoints](#user-data-endpoints)
   - [Get All Items](#get-all-items)
   - [Get Item by ID](#get-item-by-id)
   - [Update Threshold](#update-threshold)
3. [Energy Data Endpoints](#energy-data-endpoints)
   - [Get Energy History](#get-energy-history)
   - [Post Energy Input](#post-energy-input)
   - [Upload Energy Data File](#upload-energy-data-file)

---

## Authentication Endpoints

### Sign Up

Creates a new user account in the Cognito User Pool.

- **URL**: `/auth/signup`
- **Method**: `POST`
- **Authentication Required**: No

#### Request Body

```json
{
  "username": "example_user",
  "password": "Password123!",
  "email": "user@example.com"
}
```

#### Response

- **Success Response (200 OK)**:

```json
{
  "message": "User registration successful",
  "username": "username",
  "userConfirmed": false,
  "userSub": "user-id-generated-by-cognito"
}
```

- **Error Response (400 Bad Request)**:

```json
{
  "error": "Username, password, and email are required"
}
```

- **Error Response (400 Bad Request)**:

```json
{
  "error": "Invalid request body"
}
```

- **Error Response (500 Internal Server Error)**:

```json
{
  "error": "An error occurred during user registration"
}
```

#### Notes

- The password must meet the requirements set in the Cognito User Pool (minimum length, contains uppercase, lowercase, numbers, and special characters).
- After signup, the user account is not confirmed. In a production environment, users would need to verify their email address.

---

### Login

Authenticates a user and returns authentication tokens.

- **URL**: `/auth/login`
- **Method**: `POST`
- **Authentication Required**: No

#### Request Body

```json
{
  "username": "example_user",
  "password": "Password123!"
}
```

#### Response

- **Success Response (200 OK)**:

```json
{
  "message": "Login successful",
  "accessToken": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "idToken": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "refreshToken": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "expiresIn": 3600
}
```

- **Error Response (400 Bad Request)**:

```json
{
  "error": "Username and password are required"
}
```

- **Error Response (400 Bad Request)**:

```json
{
  "error": "Invalid request body"
}
```

- **Error Response (500 Internal Server Error)**:

```json
{
  "error": "An error occurred during login"
}
```

#### Notes

- The returned `IdToken` should be included in the `Authorization` header for authenticated API requests.

---

## User Data Endpoints

### Get All Items

Retrieves all user data items from the DynamoDB table. This endpoint is primarily for development and testing purposes.

- **URL**: `/items`
- **Method**: `GET`
- **Authentication Required**: Yes

#### Response

- **Success Response (200 OK)**:

```json
[
  {
    "id": "user123",
    "threshold": 30
  },
  {
    "id": "user456",
    "threshold": 25.3
  }
]
```

#### Notes

- This endpoint returns all items in the table without filtering, which may not be appropriate for production environments with large datasets.

---

### Get Item by ID

Retrieves a specific user data item by ID from the DynamoDB table. This endpoint is primarily for development and testing purposes.

- **URL**: `/items/{id}`
- **Method**: `GET`
- **Authentication Required**: Yes

#### Response

- **Success Response (200 OK)**:

```json
{
  "id": "user123",
  "threshold": 30
}
```

---

### Update Threshold

Updates the energy usage threshold value for a user.

- **URL**: `/alerts`
- **Method**: `POST`
- **Authentication Required**: Yes

#### Request Body

```json
{
  "threshold": 30
}
```

#### Response

- **Success Response (200 OK)**:

```json
{
  "message": "Threshold updated successfully",
  "updatedAttributes": { "threshold": 30 }
}
```

- **Error Response (400 Bad Request)** - When threshold value is missing:

```json
{
  "error": "Missing threshold value in request body"
}
```

- **Error Response (401 Unauthorized)** - When authentication is missing:

```json
{
  "error": "Not authenticated"
}
```

- **Error Response (500 Internal Server Error)**:

```json
{
  "message": "Error updating threshold",
  "error": "Error message"
}
```

#### Notes

- The threshold value represents the energy usage limit in kWh that the user wants to monitor.
- This value is used to trigger notifications when the user's energy usage exceeds the threshold.

---

## Energy Data Endpoints

### Get Energy History

Retrieves energy usage history for a specific date range.

- **URL**: `/energy/history`
- **Method**: `GET`
- **Query Parameters**:
  - `startDate=[string]` (required) - Start date in YYYY-MM-DD format
  - `endDate=[string]` (required) - End date in YYYY-MM-DD format
- **Authentication Required**: Yes

#### Response

- **Success Response (200 OK)**:

```json
[
  {
    "date": "2024-06-01",
    "usage": 42.5
  },
  {
    "date": "2024-06-02",
    "usage": 38.2
  }
]
```

- **Error Response (400 Bad Request)** - When required parameters are missing:

```json
{
  "message": "Missing required query parameters: startDate and endDate are required"
}
```

- **Error Response (400 Bad Request)** - When date format is invalid:

```json
{
  "message": "Invalid date format. Required format is YYYY-MM-DD"
}
```

- **Error Response (500 Internal Server Error)**:

```json
{
  "message": "Error retrieving energy history data",
  "error": "Error message"
}
```

#### Notes

- Data is retrieved from Amazon Timestream database.
- Dates are returned as a string in YYYY-MM-DD format.

---

### Post Energy Input

Records energy consumption data for the authenticated user.

- **URL**: `/energy/input`
- **Method**: `POST`
- **Authentication Required**: Yes

#### Request Body

```json
{
  "date": "2024-06-01",
  "usage": 42.5
}
```

#### Response

- **Success Response (200 OK)**:

```json
{
  "message": "Energy data saved successfully"
}
```

- **Error Response (500 Internal Server Error)**:

```json
{
  "message": "Error saving energy history data",
  "error": "Error message"
}
```

#### Notes

- If the energy consumption value exceeds the user's threshold, a notification will be sent via SNS.
- Data is stored in Amazon Timestream database.

---

### Upload Energy Data File

Copies an energy data file from a pre-signed S3 URL to the CSV upload bucket for processing.

- **URL**: `/energy/upload`
- **Method**: `POST`
- **Authentication Required**: Yes

#### Request Body

```json
{
  "presignedUrl": "https://example-bucket.s3.amazonaws.com/path/to/file.csv?AWSAccessKeyId=..."
}
```

#### Response

- **Success Response (200 OK)**:

```json
{
  "message": "Successfully processed <# items> items from <file>"
}
```

- **Error Response (400 Bad Request)** - When presigned URL is missing:

```json
{
  "error": "Missing presignedUrl in request body"
}
```

- **Error Response (500 Internal Server Error)** - When file cannot be accessed or processed:

```json
{
  "message": "Error saving energy history data",
  "error": "Error message"
}
```

#### Notes

- After the file is uploaded to the CSV upload bucket, it triggers the `process-csv` Lambda function that processes the file and stores the data in Timestream.
- The CSV file should contain energy consumption data with date and usage columns.
- Each user's files are stored in an S3 bucket with a filename in the foramt `userId-usage-timestamp.csv`.
