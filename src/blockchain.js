/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also every time you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, _reject) => {
            const chain = self.chain;
            const height = self.height + 1;
            if (height > 0) {
                block.previousBlockHash = chain[height - 1].hash;
            }

            block.height = height;
            block.time = parseInt(new Date().getTime().toString().slice(0,-3));
            block.hash = SHA256(JSON.stringify(block)).toString();
            self.chain.push(block);
            self.height++;
            resolve(block);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const timestamp = new Date().getTime().toString().slice(0,-3);
            const message = `${address}:${timestamp}:starRegistry`;
            resolve(message);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            const splitMessage = message.split(':');
            const timestamp = parseInt(splitMessage[1]);
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            const delta = currentTime - timestamp;
            const lessThanFiveMinutes = delta < 300;
            if (lessThanFiveMinutes) {
                let verified = undefined
                try {
                    verified = bitcoinMessage.verify(message, address, signature);
                } catch {
                    const error = new Error('Unable to verify bitcoin message!');
                    reject(error);
                }

                if (verified) {
                    const data = { owner: address, star: star };
                    const block = await self._addBlock(new BlockClass.Block(data));
                    const errorLog = await self.validateChain();
                    if (errorLog.length === 0) { resolve(block) }
                    else {
                        const error = new Error(`Chain is invalid: ${JSON.stringify(errorLog)}`);
                        reject(error);
                    }
                } else if (typeof verified === 'boolean') {
                    const error = new Error('Unable to verify bitcoin message!');
                    reject(error);
                }
            } else {
                const error = new Error('Time elapsed is more than or equal to five minutes!');
                reject(error);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, _reject) => {
            const chain = self.chain;
            const block = chain.find(block => block.hash === hash);
            resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, _reject) => {
            const chain = self.chain;
            const block = chain.find(block => block.height === height);
            resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress(address) {
        let self = this;
        let stars = [];
        return new Promise(async (resolve, _reject) => {
            const chain = self.chain;
            let found = []
            for (let index = 0; index < chain.length; index++) {
                const block = chain[index];
                const data = await block.getBData();
                if (data.owner === address) { found.push(data); }
            }

            stars = found.length === 0 ? undefined : found;
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, _reject) => {
            const chain = self.chain;
            for (let index = 0; index < chain.length; index++) {
                const block = chain[index];
                if (block.height !== index) {
                    const errorMessage = `Block ${index} has invalid height !`;
                    errorLog.push(errorMessage);
                }

                const valid = await block.validate();
                if (!valid) {
                    const errorMessage = `Block ${index} has invalid hash!`;
                    errorLog.push(errorMessage);
                }

                if (index > 0 && chain[index - 1].hash !== block.previousBlockHash) {
                    const errorMessage = `Block ${index} has invalid previous block hash!`;
                    errorLog.push(errorMessage);
                }
            }

            resolve(errorLog);
        });
    }
}

module.exports.Blockchain = Blockchain;
