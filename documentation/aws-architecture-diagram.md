# AWS Architecture Diagram for Energy Management Application

This diagram illustrates the AWS service flow and integrations for the Energy Management Application.

## AWS Services Architecture

```mermaid
graph TD
    %% Client-side components
    Client((User Browser)) --> CloudFront
    CloudFront --> S3WebsiteBucket[S3 Website Bucket]

    %% API Gateway and Authentication
    Client --> APIGateway[API Gateway]
    APIGateway --> Cognito[Cognito User Pool]
    Cognito --> LoginFunction[Lambda: Login]
    Cognito --> SignupFunction[Lambda: Signup]

    %% Data submission flows
    APIGateway --> PostEnergyInputFunction[Lambda: Post Energy Input]
    APIGateway --> PostEnergyUploadFunction[Lambda: Post Energy Upload]
    PostEnergyInputFunction --> |Threshold exceeded| SNSTopic[SNS Notifications Topic]
    PostEnergyInputFunction --> TimestreamDB[Timestream Database]
    PostEnergyInputFunction --> DynamoDB[DynamoDB Thresholds Table]
    PostEnergyUploadFunction --> CSVBucket[S3 CSV Upload Bucket]

    %% CSV Processing flow
    CSVBucket --> |Triggers| ProcessCSVFunction[Lambda: Process CSV]
    ProcessCSVFunction --> TimestreamDB[Timestream Database]
    ProcessCSVFunction --> DynamoDB[DynamoDB Thresholds Table]
    ProcessCSVFunction --> |Threshold exceeded| SNSTopic[SNS Notifications Topic]
    SNSTopic --> |Alerts| Client

    %% Data retrieval flows
    APIGateway --> GetEnergyHistoryFunction[Lambda: Get Energy History]
    GetEnergyHistoryFunction --> TimestreamDB
    APIGateway --> UpdateThresholdFunction[Lambda: Update Threshold]
    UpdateThresholdFunction --> DynamoDB

    %% Define styles
    classDef lambdaFunctions fill:#FF9900,stroke:#232F3E,color:black;
    classDef storage fill:#3F8624,stroke:#232F3E,color:white;
    classDef auth fill:#C925D1,stroke:#232F3E,color:white;
    classDef api fill:#407AFC,stroke:#232F3E,color:white;
    classDef delivery fill:#CD2264,stroke:#232F3E,color:white;

    %% Apply styles
    class LoginFunction,SignupFunction,PostEnergyInputFunction,PostEnergyUploadFunction,ProcessCSVFunction,GetEnergyHistoryFunction,GetAllItemsFunction,GetByIdFunction,UpdateThresholdFunction lambdaFunctions;
    class S3WebsiteBucket,CSVBucket,DynamoDB,TimestreamDB storage;
    class Cognito auth;
    class APIGateway api;
    class SNSTopic,CloudFront delivery;
```

## Data Flow Description

1. **User Authentication Flow**:

   - Users authenticate through Cognito User Pool
   - Authentication handled by Login and Signup Lambda functions

2. **Energy Data Submission Flow**:

   - Users can submit energy data directly via API (Post Energy Input)
     - Writes time series data to Timestream database
     - Checks user thresholds from DynamoDB
     - Sends notifications via SNS if thresholds are exceeded
   - Users can upload CSV files (Post Energy Upload)
   - CSV files are stored in an S3 bucket

3. **CSV Processing Flow**:

   - S3 upload triggers the Process CSV Lambda function
   - Process CSV function:
     - Reads data from S3
     - Writes time series data to Timestream database
     - Checks user thresholds from DynamoDB
     - Sends notifications via SNS if thresholds are exceeded

4. **Data Retrieval Flow**:

   - Get Energy History retrieves time-series data from Timestream
   - Get All Items, Get By ID, and Update Threshold interact with DynamoDB

5. **Frontend Hosting**:
   - Vue.js application hosted in S3 bucket
   - Delivered via CloudFront distribution

## AWS Services Used

- **Amazon Cognito**: User authentication and management
- **Amazon API Gateway**: RESTful API endpoint management
- **AWS Lambda**: Serverless function execution
- **Amazon S3**: Static website hosting and CSV file storage
- **Amazon DynamoDB**: NoSQL database for thresholds and user settings
- **Amazon Timestream**: Time series database for energy consumption data
- **Amazon SNS**: Notification service for alerts
- **Amazon CloudFront**: CDN for website content delivery
