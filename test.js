const bridges = require("./bridges.js")
async function test() {
    console.log(await bridges())
}
test()