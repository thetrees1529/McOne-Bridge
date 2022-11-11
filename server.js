const express = require("express")
const cache = require("node-cache")
const getBridges = require("./getBridges.js")
let { nftContractAddressesURL } = require("./config.json")

const { PORT } = require("dotenv").config().parsed

let bridges
let nftContractAddresses

function main() {

    async function queue(sourceChain, id) {
        try {
            nftContractAddresses = JSON.parse(await (await fetch(nftContractAddressesURL)).text())
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
        console.log(`successfully queued bridge from source chain ${sourceChain} of id ${id}`)
        return true
    }

    bridges.forEach(bridge => {
        bridge.contract.on("RequestMade", async id => {
            await queue(bridge.name, id)
        })
    })
    
    const app = express()
    app.use(express.json())
    app.get("/bridges", (req,res) => {
        res.json(bridges.map(bridge => ({name: bridge.name, queue: bridge.queued})))
    })
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