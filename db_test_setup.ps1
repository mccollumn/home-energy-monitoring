$table_name = "EnergyUsageDB"
$endpoint_url = "http://127.0.0.1:8000"

# Create a table in DynamoDB
aws dynamodb create-table --table-name $table_name --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url $endpoint_url

# Add an item to the table
# aws dynamodb put-item --table-name $table_name --item '{"id": { "S": "testuser"}, "date": {"S": "2024-06-01"}, "usage": {"N": "25.0"}}' --endpoint-url $endpoint_url
# aws dynamodb put-item --table-name $table_name --item '{"id": { "S": "testuser"}, "date": {"S": "2024-06-02"}, "usage": {"N": "26.3"}}' --endpoint-url $endpoint_url
# aws dynamodb put-item --table-name $table_name --item '{"id": { "S": "testuser"} }' --endpoint-url $endpoint_url

# Query the table for a date range
# aws dynamodb query --table-name $table_name --key-condition-expression "id = :id AND #date BETWEEN :startDate AND :endDate" --expression-attribute-names '{"#date": "date"}' --expression-attribute-values '{":id": {"S": "testuser"}, ":startDate": {"S": "2024-06-01"}, ":endDate": {"S": "2024-06-02"}}' --endpoint-url $endpoint_url

# Scan the table to confirm the item was added
aws dynamodb scan --table-name $table_name --endpoint-url $endpoint_url