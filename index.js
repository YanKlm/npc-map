const npcList = require("./npc_list.json")
const zoneMaps = require("./zone_maps.json")
const continents = require("./continents.json")
const zoneNames = require('./StrSheet_ZoneName.json')
const Vec3 = require("tera-vec3");

module.exports = function NPCMap(mod) {

    const npcById = new Map();
	const questStrings = new Map();
	const questList=[];
	let locationEvent = null;

mod.hook("C_PLAYER_LOCATION", 5, event => {
		locationEvent = event;
});
	
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
        const coords = `${npc.x},${npc.y},${npc.z}`
		const zone = zoneNameMap.get(npc.zone) || "Link"
console.log(`${npc.name} map: ${map}, continent:${continent}, zone:${npc.zone} or ${zone}`);

		const res = `<ChatLinkAction param="3#####${map}@${continent}@${coords}"> ${zone}</ChatLinkAction>`
        return res
    };


function findChild(node, name) {
	if (!node || !node.children) return null;
    return node.children.find(c => c.name === name);
}

async function loadQuestStrings() {
    const strings = await mod.queryData('/StrSheet_Quest/String', [], true);

    for (const s of strings) {
        const id = parseInt(s.attributes.id);
        const text = s.attributes.string;
        questStrings.set(id, text);
    }

    console.log(`Loaded ${questStrings.size} quest strings`);
};

async function loadQuests() {
    const quests = await mod.queryData('/Quest', [], true);

    for (const quest of quests) {

        const id = parseInt(quest.attributes.id);
        const header = findChild(quest, "Header"); 
        const titleNode = findChild(header, "Quest제목");
		const req = findChild(header, "수행조건");
		const firstNpc = findChild(findChild(header, "발생조건"), "NPC대화")?.attributes?.__value__;
		let preQuest = [];
			const preQuestRoot = findChild(req, "선행퀘스트");
			if (preQuestRoot && preQuestRoot.children) {
				for (const entry of preQuestRoot.children) {
					const questIdNode = findChild(entry, "퀘스트Id");
					if (questIdNode ) {
						let value = questIdNode.attributes.__value__;
						if (value) {
							const [g, i] = value.split(",").map(Number);
							preQuest.push(g * 100 + i);
						}
					}
				}
			}
        let name = null;

        if (titleNode) {
            const key = titleNode.attributes.__value__; // "@quest:805001"
            const stringId = parseInt(key.split(":")[1]);
            name = questStrings.get(stringId);
        }

        const data = {
            id,
            name,
			firstNpc,
			preQuest
        };
		questList.push(data);


    }
    console.log(`Loaded ${questList.length} quests`);
}


mod.command.add("quest", async (arg) => {

    if (questStrings.size === 0) {
        await loadQuestStrings();
        await loadQuests();
        mod.command.message("Quest data loaded");
    }

    if (!arg) {
        mod.command.message("Usage: quest id | name");
        return;
    }

    let list = [];

    if (!isNaN(arg)) {

        const q = questList.find(el => el.id == Number(arg));

        if (!q) {
            mod.command.message("No quest with this ID");
            return;
        }

        list.push(q);

    } else {

        const search = arg.toLowerCase();

        list = questList.filter(el =>
            el.name?.toLowerCase().includes(search)
        );

        if (!list.length) {
            mod.command.message("No quest found");
            return;
        }

    }

    const max_limit = 10;

    for (let i = 0; i < max_limit && i < list.length; i++) {

        let quest = list[i];

            let npcname = "";
			let npcLink = "";

            if (quest.firstNpc?.includes(",")) {

                const [zoneStr, templateStr] = quest.firstNpc.split(",");
                const zone = Number(zoneStr);
                const templateId = Number(templateStr);

                if (!Number.isNaN(zone) && !Number.isNaN(templateId)) {

                    const npc = npcList.find(el =>
                        el.zone === zone && el.templateId === templateId
                    );
					
					if (npc){
						npcname= npc?.name
						npcLink = buildLink(npc); 

					} else {
						
					mod.command.message("Location data error");
					const getNpc = await mod.queryData('/StrSheet_Creature/HuntingZone@id=?/String@templateId=?', [zone, templateId], true);
					npcname = getNpc?.[0]?.attributes?.name ?? "";

					}
					
                }
            }

            let prevQuestId = "-";
            if (quest.preQuest && quest.preQuest.length>0) {

                prevQuestId = quest.preQuest.join(",");
            }

            mod.command.message(
                `${quest.id} (${quest.name}) : NPC ${npcname} (${quest.firstNpc} ${npcLink}) prev: ${prevQuestId}`
            );

    }

});


    mod.command.add("npc", (arg, arg2) => {

        if (!arg) {
            mod.command.message("Usage: /8 npc <id | name | zone,templateId | to id>");
            return
        };

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
        };
        
        //teleport
        if ((arg=="to") && arg2 && !isNaN(arg2)) {
            if (!locationEvent) return;
            const npc = npcById.get(Number(arg2));
            if (!npc) {
                mod.command.message("NPC not found");
                return;
            };
            /*
            if (npc.zone != playerZone) {
                mod.command.message(`Zone error: npc in ${npc.zone}, player ${playerZone}`)
                return;
            }; */
            mod.send("S_INSTANT_MOVE", 3, {
                "gameId": mod.game.me.gameId,
                "loc": new Vec3(npc.x, npc.y, npc.z),
                "w": locationEvent.w
		    });
            return;
        };


		//search by zone,templateId		
		let list = [];
		if (arg.includes(",")){
            const zone = Number(arg.split(",")[0]);
		  const templateId = Number(arg.split(",")[1]);
		  if(isNaN(zone) || isNaN(templateId)) return;
		  list = npcList.filter(npc=>npc.zone ==zone && npc.templateId==templateId);
		  
		} else {
			
        // search by name
        const name = arg.toLowerCase();

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
	};

		mod.command.message(`Found ${list.length} results:`);

		for (const npc of list) {
			const link = buildLink(npc);
			mod.command.message(`${npc.name} (ID ${npc.id}): ${link}`);
		}

    })

}
