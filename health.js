const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
const prom_app = express();
const Prometheus = require('prom-client');

dotenv.config();

const N = parseInt(process.env.BLOCKS_BEHIND_THRESHOLD) || 100;
const M = parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 500;
const Y = process.env.ERROR_RATE_LOOKBACK || 10;
const errorThreshold = process.env.ERROR_THRESHOLD || 10; // 10% error rate
const pollInterval = parseInt(process.env.POLL_INTERVAL) || 10000; // 10 seconds
const indexerServiceUrl = process.env.INDEXER_SERVICE_URL || "https://api.thegraph.com/";
const subgraphDeployment = process.env.SUBGRAPH_DEPL || "QmV614UpBCpuusv5MsismmPYu4KqLtdeNMKpiNrX56kw6u";
const subgraphHost = process.env.SUBGRAPH_HOST || "api.thegraph.com";
const rpcURL = process.env.RPC_URL || "https://mainnet.infura.io/v3/your-infura-project-id";
const bearerToken = process.env.BEARER_TOKEN;
let healthStatus = "unknown";
let errorRates = [];

// Prometheus metrics
// Create a Registry which registers the metrics
const register = new Prometheus.Registry()
const deltaMetric = new Prometheus.Gauge({ name: 'block_number_delta', help: 'Block number delta between Infura and The Graph' });
const responseTimeMetric = new Prometheus.Gauge({ name: 'response_time', help: 'Response time in milliseconds' });
const errorRateMetric = new Prometheus.Gauge({ name: 'error_rate', help: 'Average error rate for the past Y queries' });

register.registerMetric(deltaMetric);
register.registerMetric(responseTimeMetric);
register.registerMetric(errorRateMetric);

const calculateAverageErrorRate = () => {
    let total = 0;
    for (let i = 0; i < errorRates.length; i++) {
        total += errorRates[i];
    }
    return total / errorRates.length;
};

const checkHealth = async () => {
    try {
        console.log(`Checking health status...`)
        const startTime = Date.now();

        const subgraphResponse = await axios.post(indexerServiceUrl+"/subgraphs/id/"+subgraphDeployment, {
            query: '{_meta{block{number}}}'
        }, {
            headers: {
                Authorization: `Bearer ${bearerToken}`,
                Host: subgraphHost
            }
        });
        const responseTime = Date.now() - startTime;

        const subgraphBlockNumber = JSON.parse(subgraphResponse.data.graphQLResponse).data._meta.block.number;
        const { data: infuraBlockNumberResponse } = await axios.post(rpcURL, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
        });
        const infuraBlockNumber = parseInt(infuraBlockNumberResponse.result,16);
        const delta = Math.abs(parseInt(subgraphBlockNumber) - infuraBlockNumber);

        console.log(`Subgraph block number: ${subgraphBlockNumber}, Infura block number: ${infuraBlockNumber}, Delta: ${delta}, Response time: ${responseTime}ms`);
        if (delta > N || responseTime > M) {
            errorRates.push(1);
        } else {
            errorRates.push(0);
        }
        if (errorRates.length > Y) {
            errorRates.shift();
        }

        deltaMetric.set(delta);
        responseTimeMetric.set(responseTime);

    } catch (error) {
        console.error(error);
        errorRates.push(1);
        if (errorRates.length > Y) {
            errorRates.shift();
        }
        deltaMetric.set(-1);
        responseTimeMetric.set(-1);

    } finally {
        const averageErrorRate = calculateAverageErrorRate();
        console.log(`Average error rate for the past ${Y} queries: ${averageErrorRate}`);

        if (averageErrorRate * 100 > errorThreshold) {
            healthStatus = "unhealthy";
        } else {
            healthStatus = "healthy";
        }
        errorRateMetric.set(averageErrorRate * 100);
    }
};

app.get('/health', (req, res) => {
    console.log(`Received /health request, health status: ${healthStatus}`);
    if (healthStatus === "healthy") {
        res.status(200).send("healthy");
    } else {
        res.status(503).send("unhealthy");
    }
});


app.listen(3000, () => {
    console.log('Health status server listening on port 3000!');
});
prom_app.listen(9090, () => {
    console.log('Prometheus metrics server listening on port 9090!');
});
prom_app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    register.metrics().then((data) => {
        res.send(data);
    });
});

checkHealth().then();
setInterval(checkHealth, pollInterval);
