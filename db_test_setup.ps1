$table_name = "Users"
$endpoint_url = "http://127.0.0.1:8000"

# Create a table in DynamoDB
aws dynamodb create-table --table-name $table_name --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url $endpoint_url

# Add an item to the table
aws dynamodb put-item --table-name $table_name --item '{"id": {"S": "A1234"}, "name": {"S": "randeepx"}}' --endpoint-url $endpoint_url

# Scan the table to confirm the item was added
aws dynamodb scan --table-name $table_name --endpoint-url $endpoint_url