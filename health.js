const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
const prom_app = express();
const Prometheus = require('prom-client');

dotenv.config();

const getConfig = (chainPrefix) => ({
    N: parseInt(process.env[chainPrefix + "BLOCKS_BEHIND_THRESHOLD"]) || 100,
    M: parseInt(process.env[chainPrefix + "RESPONSE_TIME_THRESHOLD"]) || 500,
    Y: process.env[chainPrefix + "ERROR_RATE_LOOKBACK"] || 10,
    errorThreshold: process.env[chainPrefix + "ERROR_THRESHOLD"] || 10,
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 10000,
    indexerServiceUrl: process.env.INDEXER_SERVICE_URL || "https://api.thegraph.com/",
    subgraphDeployment: process.env[chainPrefix + "SUBGRAPH_DEPL"] || "QmV614UpBCpuusv5MsismmPYu4KqLtdeNMKpiNrX56kw6u",
    subgraphHost: process.env.SUBGRAPH_HOST || "api.thegraph.com",
    rpcURL: process.env[chainPrefix + "RPC_URL"] || "https://mainnet.infura.io/v3/your-infura-project-id",
    bearerToken: process.env.BEARER_TOKEN,
    name: process.env[chainPrefix + "NAME"] || "unknown"
});

let healthStatuses = {};

// Prometheus metrics
// Create a Registry which registers the metrics
const register = new Prometheus.Registry()
const deltaMetric = new Prometheus.Gauge({ name: 'block_number_delta', help: 'Block number delta between Infura and The Graph' });
const responseTimeMetric = new Prometheus.Gauge({ name: 'response_time', help: 'Response time in milliseconds' });
const errorRateMetric = new Prometheus.Gauge({ name: 'error_rate', help: 'Average error rate for the past Y queries' });

register.registerMetric(deltaMetric);
register.registerMetric(responseTimeMetric);
register.registerMetric(errorRateMetric);

const calculateAverageErrorRate = (errorRates) => {
    let total = 0;
    for (let i = 0; i < errorRates.length; i++) {
        total += errorRates[i];
    }
    return total / errorRates.length;
};

const checkHealth = async (config, errorRates) => {
    try {
        console.log(`[${config.name}] Checking health status...`);

        const startTime = Date.now();

        const subgraphResponse = await axios.post(config.indexerServiceUrl+"/subgraphs/id/"+config.subgraphDeployment, {
            query: '{_meta{block{number}}}'
        }, {
            headers: {
                Authorization: `Bearer ${config.bearerToken}`,
                Host: config.subgraphHost
            }
        });
        const responseTime = Date.now() - startTime;

        const subgraphBlockNumber = JSON.parse(subgraphResponse.data.graphQLResponse).data._meta.block.number;
        const { data: infuraBlockNumberResponse } = await axios.post(config.rpcURL, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
        });
        const infuraBlockNumber = parseInt(infuraBlockNumberResponse.result,16);
        const delta = Math.abs(parseInt(subgraphBlockNumber) - infuraBlockNumber);

        console.log(`[${config.name}] Subgraph block number: ${subgraphBlockNumber}, Infura block number: ${infuraBlockNumber}, Delta: ${delta}, Response time: ${responseTime}ms`);

        if (delta > config.N || responseTime > config.M) {
            errorRates.push(1);
        } else {
            errorRates.push(0);
        }
        if (errorRates.length > config.Y) {
            errorRates.shift();
        }

        deltaMetric.set(delta);
        responseTimeMetric.set(responseTime);

    } catch (error) {
        console.error(`[${config.name}]`, error);
        errorRates.push(1);
        if (errorRates.length > config.Y) {
            errorRates.shift();
        }
        deltaMetric.set(-1);
        responseTimeMetric.set(-1);

    } finally {
        const averageErrorRate = calculateAverageErrorRate(errorRates);
        console.log(`[${config.name}] Average error rate for the past ${config.Y} queries: ${averageErrorRate}`);

        if (averageErrorRate * 100 > config.errorThreshold) {
            healthStatus = "unhealthy";
        } else {
            healthStatus = "healthy";
        }
        errorRateMetric.set(averageErrorRate * 100);
    }
    return healthStatus;
};

app.get('/health', (req, res) => {
    console.log(`Received /health request, health statuses:`, healthStatuses);
    const unhealthyChains = Object.entries(healthStatuses).filter(([_, status]) => status === 'unhealthy');
    if (unhealthyChains.length === 0) {
        res.status(200).send("healthy");
    } else {
        res.status(503).send(`unhealthy: ${unhealthyChains.map(([chain]) => chain).join(', ')}`);
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

const startMonitoring = (chainPrefix) => {
    const config = getConfig(chainPrefix);
    const errorRates = [];
    const healthCheck = async () => {
        healthStatuses[config.name] = await checkHealth(config, errorRates);
        setTimeout(healthCheck, config.pollInterval);
    };
    healthCheck().then();
};

const getChains = () => {
    let chainPrefixes = [];
    let i = 1;
    while (process.env[`CHAIN${i}_NAME`]) {
        chainPrefixes.push(`CHAIN${i}_`);
        i++;
    }
    return chainPrefixes;
};

const chains = getChains(); // This will return an array of configured chain prefixes

chains.forEach(startMonitoring);

