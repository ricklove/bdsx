
// Network Hooking: disconnected
import { PlayerCommandSelector } from "bdsx/bds/command";
import { ServerPlayer } from "bdsx/bds/player";
import { serverInstance } from "bdsx/bds/server";
import { command } from "bdsx/command";
import { events } from "bdsx/event";
import { connectionList } from "./net-login";

events.networkDisconnected.on(networkIdentifier => {
    const id = connectionList.get(networkIdentifier);
    connectionList.delete(networkIdentifier);
    console.log(`${id}> disconnected`);
});

command.register("disconnect", "disconnect player").overload((p, o, op) => {
    for (const player of p.target.newResults(o, ServerPlayer)) {
        // disconnect player from server
        serverInstance.disconnectClient(player.getNetworkIdentifier());
    }
}, {
    target:PlayerCommandSelector
});
