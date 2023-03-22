## Indexer Health Check

This is a simple health check to ensure that the indexer is running and indexing blocks for multiple chains. If the indexer is not running, the health check will fail.

It checks for the response time, and number of blocks behind.

## Environment Variables

Create a `.env` file in the project root directory with the following environment variables. Use the `.env.example` file as a reference:

- BEARER_TOKEN: The bearer token to use for authentication. E.g. your_bearer_token
- POLL_INTERVAL: The interval in milliseconds between health checks. E.g. 10000
- INDEXER_SERVICE_URL: The URL of the indexer service. E.g. http://localhost:80
- SUBGRAPH_HOST: The host for the subgraph. E.g. your_subgraph_host

For each chain, configure the following variables with the chain's prefix (e.g., CHAIN1_, CHAIN2_):

- CHAINX_NAME: The name of the chain to check
- CHAINX_BLOCKS_BEHIND_THRESHOLD: The number of blocks behind the indexer can be before the health check fails. E.g. 100
- CHAINX_RESPONSE_TIME_THRESHOLD: The maximum response time of the indexer in milliseconds before the health check fails. E.g. 500
- CHAINX_ERROR_RATE_LOOKBACK: The number of queries to look back for calculating the error rate. E.g. 10
- CHAINX_ERROR_THRESHOLD: The error threshold percentage to consider the chain unhealthy. E.g. 10
- CHAINX_SUBGRAPH_DEPL: The subgraph deployment ID for the chain. E.g. chain1_subgraph_deployment_id
- CHAINX_RPC_URL: The URL of a reference JSON-RPC endpoint for the chain. E.g. chain1_rpc_url

## Usage

The health check can be run with the following command:

    npm start

