const Aws = require('aws-sdk');
Aws.config.update({
    region: 'us-east-1'
});
const dynamodb = new Aws.DynamoDB.DocumentClient();
const dynamodbTableName = 'products';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';
let response;

exports.handler = async function(event){
    console.log('Request event: ', event);
    switch(true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path == productsPath:
            response = await getProduct(event.queryStringParameters.productId);
            break;
        case event.httpMethod === 'GET' && event.path == productPath:
            response = await getProducts();
            break;
        case event.httpMethod === 'POST' && event.path == productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path == productPath:
            const requestBody = JSON.parse(event.body);
            response = await modifyProduct(requestBody.productId, requestBody.updateKey, requestBody.updateValue);
            break;
        default:
            response = buildResponse(404, '404 not found')

    }
    return response;
}

async function getProduct(productId) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'productId': productId
        }
    }
    return await dynamodb.get(params).promise().then(() => {
        return buildResponse(200, response.Item);
    }, (error) => {
        console.log(error);
    });
}

async function getProducts(){
    const params = {
        TableName: dynamodbTableName
    }
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
        products: allProducts
    }
    return buildResponse(200,body);
}

async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if(dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error) {
        console.log(error);
    }
}

async function saveProduct(requestBody) {
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    }
    return await dynamodb.put(params).promise().then(() => {
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        }
        return buildResponse(200, body);
    }, (error) => {
        console.log(error);
    })
}

async function modifyProduct(productId, updateKey, updateValue) {
    const params = {
        TableName: dynamodbTableName,
        Key:{
            'productId': productId
        },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value':updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    }
    return await dynamodb.update(params).promise().then(() => {
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            Item: response
        }
        return buildResponse(200, body);
    }, (error) => {
        console.log(error);
    })
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }
}
