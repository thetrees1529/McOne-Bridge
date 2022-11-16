const express = require("express")
const cache = require("node-cache")
const abi = require("./abis/ERC721.json").abi
const getBridges = require("./getBridges.js")
let { nftContractAddressesURL } = require("./config.json")
const { ethers } = require("ethers")

const { PORT } = require("dotenv").config().parsed

let bridges
let nftContractAddresses

function main() {

    function findBridge(name) {
        const bridge = bridges.find(bri => name == bri.name)
        if(!bridge) throw new Error("bridge not found")
        return bridge
    }

    async function queue(sourceChain, id) {
        try {
            nftContractAddresses = await getNftContractAddresses()
            const bridge = findBridge(sourceChain)
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
        res.json(bridges.map(bridge => ({name: bridge.name, queue: bridge.queued, contractAddress: bridge.contract.address})))
    })
    app.get("/options", async (req,res) => {
        try {

            const nftContractAddresses = await getNftContractAddresses()

            res.send (await Promise.all(nftContractAddresses.map(async arr => {
                return await Promise.all(arr.map(async el => {
                    const contract = new ethers.Contract(el.contractAddress, abi, findBridge(el.chain).provider)
                    return {
                        chain: el.name, 
                        nft: {
                            contractAddress: el.contractAddress,
                            name: await contract.name(),
                            symbol: await contract.symbol()
                        }
                    }
                }))
            })))
        } catch(e) {
            console.log(`failed to get options with reason: ${e}`)
            res.sendStatus(500)
        }

    })
    app.post("/queueRequest", async (req, res) => {
        const { sourceChain, id } = req.body
        const success = await queue(sourceChain, id)
        if(!success) return res.sendStatus(500)
        res.sendStatus(200)
    })

    app.listen(PORT, ()=>console.log(`listening on port ${PORT}`))
}

async function getNftContractAddresses() {
    return JSON.parse(await (await fetch(nftContractAddressesURL)).text())
}

(async () => {
    bridges = await getBridges()
})().then(main)