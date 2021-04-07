import { LoopbackPacketSender } from "bdsx/bds/loopbacksender";
import { VoidPointer } from "bdsx/core";
import { NativeClass } from "bdsx/nativeclass";
import { CxxString } from "bdsx/nativetype";
import { SharedPtr } from "bdsx/sharedpointer";
import { NetworkIdentifier } from "bdsx";
import { abstract } from "../common";
import { DimensionId } from "./actor";
import { MinecraftCommands } from "./command";
import { Dimension } from "./dimension";
import { Level, ServerLevel } from "./level";
import { NetworkHandler, ServerNetworkHandler } from "./networkidentifier";
import { CxxStringWrapper } from "../pointer";

export class MinecraftEventing extends NativeClass {}
export class ResourcePackManager extends NativeClass {}
export class Whitelist extends NativeClass {}
export class PrivateKeyManager extends NativeClass {}
export class ServerMetrics extends NativeClass {}
export class ServerMetricsImpl extends ServerMetrics {}
export class VanilaServerGameplayEventListener extends NativeClass {}
export class EntityRegistryOwned extends NativeClass {}

/**
 * unknown instance
 */
export class Minecraft$Something extends NativeClass {
    network:NetworkHandler;
    level:ServerLevel;
    shandler:ServerNetworkHandler;
}

export class VanilaGameModuleServer extends NativeClass {
    listener:VanilaServerGameplayEventListener;
}

export class Minecraft extends NativeClass {
    vftable:VoidPointer;
    serverInstance:ServerInstance;
    minecraftEventing:MinecraftEventing;
    resourcePackManager:ResourcePackManager;
    offset_20:VoidPointer;
    vanillaGameModuleServer:SharedPtr<VanilaGameModuleServer>; // VanilaGameModuleServer
    whitelist:Whitelist;
    permissionsJsonFileName:CxxString;
    privateKeyManager:PrivateKeyManager;
    serverMetrics:ServerMetrics;
    commands:MinecraftCommands;
    something:Minecraft$Something;
    network:NetworkHandler;
    LoopbackPacketSender:LoopbackPacketSender;
    server:DedicatedServer;
    entityRegistryOwned:SharedPtr<EntityRegistryOwned>;

    getLevel():Level {
        abstract();
    }
}

export class DedicatedServer extends NativeClass {
}

// struct DedicatedServer :ScriptCommandOrigin
// {
//     struct Something
//     {
//         Vector<VoidPointer> vector1;
//         Vector<VoidPointer> vector2;
//         VoidPointer u1;
//         VoidPointer u2;
//     };
//     DedicatedServer() = delete;


export class ScriptFramework extends NativeClass {
    vftable:VoidPointer;
}

export class MinecraftServerScriptEngine extends ScriptFramework {
    scriptEngineVftable:VoidPointer;
}

export class ServerInstance extends NativeClass {
    vftable:VoidPointer;
    server:DedicatedServer;
    minecraft:Minecraft;
    networkHandler:NetworkHandler;
    scriptEngine:MinecraftServerScriptEngine;

    protected _disconnectAllClients(message:CxxStringWrapper):void {
        abstract();
    }

    createDimension(id:DimensionId):Dimension {
        return this.minecraft.something.level.createDimension(id);
    }
    getActivePlayerCount():number {
        return this.minecraft.something.level.getActivePlayerCount();
    }
    disconnectAllClients(message:string="disconnectionScreen.disconnected"):void {
        const _message = new CxxStringWrapper(true);
        _message.construct();
        _message.value = message;
        this._disconnectAllClients(_message);
        _message.destruct();
    }
    disconnectClient(client:NetworkIdentifier, message:string="disconnectionScreen.disconnected"):void {
        return this.minecraft.something.shandler.disconnectClient(client, message);
    }
    getMotd():string {
        return this.minecraft.something.shandler.motd;
    }
    setMotd(motd:string):void {
        return this.minecraft.something.shandler.setMotd(motd);
    }
    getMaxPlayers():number {
        return this.minecraft.something.shandler.maxPlayers;
    }
    setMaxPlayers(count:number):void {
        this.minecraft.something.shandler.setMaxPlayers(count);
    }
}

export let serverInstance:ServerInstance;

