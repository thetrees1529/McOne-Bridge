const express = require("express")
const path = require("path")
const getBridges = require("./getBridges.js")
const  { nftContractAddresses } = require("./config.json")

const { PORT } = require("dotenv").config().parsed

let bridges

function main() {

    async function queue(sourceChain, id) {
        try {
            const bridge = bridges.find(bridge => sourceChain == bridge.name)
            const bridging = await bridge.contract.getBridging(id)
            const destBridge = bridges.find(el => el.name == bridging.dest.chain)

            const completed = await destBridge.contract.externalCompletions(id)
            if(completed) return false
    
            const nftContractAddress = nftContractAddresses.find(
                pool => pool.find(
                    el => el.contractAddress == bridging.nft.imp
                )
            ).find(el => el.chain == bridging.dest.chain)
            .contractAddress
    
            destBridge.queue({
                id,
                nft: {
                    imp: nftContractAddress,
                    tokenId: bridging.nft.tokenId
                },
                receiver: bridging.dest.receiver
            })

        } catch(e) {
            console.log(`failed to queue bridge from source chain ${sourceChain} of id ${id} with reason: ${e}`)
            return false
        }
        return true
    }

    bridges.forEach(bridge => {
        bridge.contract.on("RequestMade", async (log, event) => {
            await queue(bridge.name, event.id)
        })
    })
    
    const app = express()
    app.use(express.json())
    app.post("/queueRequest", async (req, res) => {
        const { sourceChain, id } = req.body
        const success = await queue(sourceChain, id)
        if(!success) return res.sendStatus(500)
        res.sendStatus(200)
    })

    app.listen(PORT, ()=>console.log(`listening on port ${PORT}`))
}

(async () => {
    bridges = await getBridges()
})().then(main)