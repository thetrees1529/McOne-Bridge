const ethers = require("ethers")
const abi = require("./abis/Bridge.json").abi
const privateKey = require("./privateKey.json")
const { chains } = require("./config.json")

async function get() {
    return await Promise.all(
        chains.map(async chain => {
            const provider = new ethers.providers.JsonRpcProvider(chain.rpc)
            const wallet = new ethers.Wallet(privateKey, provider)
            const contract = new ethers.Contract(chain.contractAddress, abi, wallet)
            const bridge = {
                name: await contract.chain(),
                contract,
                queue (bridging) {
                    this.queued.push(bridging)
                },
                queued: [],
                processing: false
            }
            setInterval((async function() {
                if(!this.processing && this.queued.length > 0) {
                    this.processing = true
                    console.log(`processing queue for chain ${this.name}`)
                    while(this.queued.length > 0) {
                        const item = this.queued.pop()
                        try {
                            const tx = await this.contract.release(item.id, item.nft, item.receiver)
                            await tx.wait()
                        } catch(e) {
                            console.log(`bridge failed on destination chain ${this.name} for ${item} with reason: ${e}`)
                        }
                    }
                    console.log(`completed processing bridges on destination chain ${this.name}`)
                    this.processing = false
                }
            }).bind(bridge), 1000) 
            return bridge
        })
    )
}

module.exports = async () => {
    const bridges = await get()
    
    return bridges
}
