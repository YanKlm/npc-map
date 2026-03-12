const npcList = require("./npc_list.json")
const zoneMaps = require("./zone_maps.json")
const continents = require("./continents.json")
const zoneNames = require('./StrSheet_ZoneName.json')

module.exports = function NPCMap(mod) {

    const npcById = new Map()
    //const npcByName = new Map()

    for (const npc of npcList) {

        npcById.set(npc.id, npc)
		npc._nameLower = npc.name.toLowerCase();
    }
	const zoneNameMap = new Map()
    zoneNames.String.forEach(z => {
        zoneNameMap.set(z.id, z.string.trim())
    })

    function buildLink(npc) {

        const map = zoneMaps[npc.zone] ||"0"
		const continent = continents[npc.zone] ||"0"
console.log(`${npc.name} map: ${map}, continent:${continent}`);
        if (!map)
            return "(map unknown)"

        const coords = `${npc.x},${npc.y},${npc.z}`
		const zone = zoneNameMap.get(npc.zone) || "Unknown"

		const res = `<ChatLinkAction param="3#####${map}@${continent}@${coords}"> ${zone}</ChatLinkAction>`
console.log(res);
        return res
    }

    mod.command.add("npc", arg => {

        if (!arg) {
            mod.command.message("Usage: /8 npc <id | name>")
            return
        }

        // search by id
        if (!isNaN(arg)) {
			
            const npc = npcById.get(Number(arg))
			console.log(npc);

            if (!npc) {
                mod.command.message("NPC not found")
                return
            }

            const link = buildLink(npc)

            mod.command.message(`${npc.name} (ID ${npc.id}): ${link}`)
            return
        }

        // search by name
        const name = arg.toLowerCase();
		const list = [];

		for (const npc of npcList) {
			if (npc._nameLower.includes(name)) {
				list.push(npc);
				if (list.length >= 10) break;
			}
		}

		if (list.length === 0) {
			mod.command.message("NPC not found");
			return;
		}

		mod.command.message(`Found ${list.length} results:`);

		for (const npc of list) {
			const link = buildLink(npc);
			mod.command.message(`${npc.name} (ID ${npc.id}): ${link}`);
		}

    })

}