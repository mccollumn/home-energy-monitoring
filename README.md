# home-energy-monitoring

This project contains source code and supporting files for a serverless application that can be deployed with the AWS Serverless Application Model CLI. It includes the following files and folders:

- `backend/src` - Code for the application's Lambda function.
- `backend/events` - Invocation events that you can use to invoke the function.
- `backend/__tests__` - Unit tests for the application code.
- `template.yaml` - A template that defines the application's AWS resources.
- `frontend` - A single page app for viewing and updating energy usage data.

## Deploy the Backend

Ensure the following tools are installed:

- AWS SAM CLI - [Install the AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html).
- Node.js - [Install Node.js 22](https://nodejs.org/en/), including the npm package management tool.
- Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community).

To build and deploy the application, run the following:

```bash
sam build
sam deploy --guided
```

- **Stack Name**: The name of the stack to deploy to CloudFormation. This should be unique to your account and region.
- **AWS Region**: The AWS region you want to deploy the app to.
- **Confirm changes before deploy**: If set to yes, any change sets will be shown to you before execution for manual review. If set to no, the AWS SAM CLI will automatically deploy application changes.
- **Allow SAM CLI IAM role creation**: The AWS SAM template creates AWS IAM roles required for the AWS Lambda functions included to access AWS services. By default, these are scoped down to minimum required permissions. To deploy an AWS CloudFormation stack which creates or modifies IAM roles, the `CAPABILITY_IAM` value for `capabilities` must be provided. If permission isn't provided through this prompt, to deploy you must explicitly pass `--capabilities CAPABILITY_IAM` to the `sam deploy` command.
- **Save arguments to samconfig.toml**: If set to yes, your choices will be saved to a configuration file inside the project, so that in the future you can just re-run `sam deploy` without parameters to deploy changes to your application.

The following outputs will be displayed when the deployment is complete:

- API Gateway endpoint API
- CloudFront Distribution ID
- CloudFront domain name
- S3 Bucket for Front End source files
- Cognito User Pool ID for user authentication
- Cognito User Pool Client ID for user authentication
- S3 Bucket for CSV file uploads

## Deploy the Front End

The included `deploy_frontend.sh` bash script or `deploy_fronted.ps1` PowerShell script can be run to automatically deploy the front end website to the AWS account. Run using one of the following commands:

```bash
./deploy_frontend.sh
```

```powershell
./deploy_frontend.ps1
```

## Regarding CORS

For security, it is recommended to restrict the Allowed Origin value to restrict HTTP requests that are initiated from scripts running in the browser. See here for more information:

- Configuring CORS for an HTTP API - [Configuring CORS for an HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html).

## Use the AWS SAM CLI to build and test locally

Build your application by using the `sam build` command.

```bash
my-application$ sam build
```

The AWS SAM CLI installs dependencies that are defined in `package.json`, creates a deployment package, and saves it in the `.aws-sam/build` folder.

Test a single function by invoking it directly with a test event. An event is a JSON document that represents the input that the function receives from the event source. Test events are included in the `events` folder in this project.

Run functions locally and invoke them with the `sam local invoke` command.

```bash
my-application$ sam local invoke putItemFunction --event events/event-post-item.json
my-application$ sam local invoke getAllItemsFunction --event events/event-get-all-items.json
```

Use the `sam local start-api` command to run the API locally on port 3000.

```bash
my-application$ sam local start-api
my-application$ curl http://localhost:3000/
```

## Test locally with DynamoDB

1. Start DynamoDB Local in a Docker container

```bash
docker run --rm -p 8000:8000 -v /tmp:/data amazon/dynamodb-local
```

2. Create the DynamoDB table (sample command below):

```bash
aws dynamodb create-table --table-name SampleTable --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url http://127.0.0.1:8000
```

3. Retrieve the ip address of your docker container running dynamodb local:

```bash
docker inspect <container_name_or_id> -f  '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

4. Update locals.json with the IP of your docker container for the endpoint override - see here for example:

```json
{
  "getByIdFunction": {
    "ENDPOINT_OVERRIDE": "http://172.17.0.2:8000",
    "TABLE": "SampleTable"
  },
  "postItemFunction": {
    "ENDPOINT_OVERRIDE": "http://172.17.0.2:8000",
    "TABLE": "SampleTable"
  }
}
```

5. Run the following commands to start the sam local api:

```bash
sam local start-api --env-vars locals.json --host 0.0.0.0 --debug
```

6. For testing - you can put an item into dynamodb local

```bash
aws dynamodb put-item \
    --table-name EnergyUsageDB \
    --item '{"id": {"S": "testuser"}, "threshold": {"N": "30"}}' \
    --endpoint-url http://127.0.0.1:8000
```

7. How to scan your table for items

```bash
aws dynamodb scan --table-name SampleTable --endpoint-url http://127.0.0.1:8000
```

8. To run frontend application locally:
   Go to the `frontend` code directory

```bash
cd frontend
```

Make backend API endpoint accessible as an environment variable. For local, create a `.env` file, Here is an example:

```text
VUE_APP_API_ENDPOINT=http://127.0.0.1:3000/
```

9. Run following command to compile and run (with hot-reloads) for development

```bash
npm run serve
```

10. to execute frontend unit test

```bash
npm run test
```

## Unit tests

Tests are defined in the `__tests__` folder in this project. Use `npm` to install the [Jest test framework](https://jestjs.io/) and run unit tests.

```bash
my-application$ npm install
my-application$ npm run test
```
