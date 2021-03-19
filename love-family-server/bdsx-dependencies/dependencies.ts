import { command, NetworkIdentifier } from "bdsx";
import { nethook, PacketId } from "bdsx";
import { ShowModalFormPacket } from "bdsx/bds/packets";
import { CommandServiceDependencyType, createCommandService } from "../src/tools/commandService";
import { createFormsApi, FormsApiDependenciesType } from "../src/tools/formsApi";
import { ConnectionsTrackingServiceDependencies, ConnectionsTrackingServiceType, createConnectionsTrackingService } from "../src/tools/playerConnections";
import { ServicesType } from "../src/tools/services";
import { NetworkIdentifier as NetworkIdentifierAlias } from "../src/types";

const getNetworkIdentifier = (networkIdentifier: NetworkIdentifierAlias) => networkIdentifier as unknown as NetworkIdentifier;
const getNetworkIdentifierAlias = (networkIdentifier: NetworkIdentifier) => networkIdentifier as unknown as NetworkIdentifierAlias;

export const createFormsApiDependencies = (): FormsApiDependenciesType => {
    return {
        sendForm: ({ formId, content, networkIdentifier }) => {
            let packet = ShowModalFormPacket.create();
            packet.id = formId;
            packet.content = content;
            packet.sendTo(getNetworkIdentifier(networkIdentifier), 0);
            packet.dispose();
        },
        onFormResponse: (callback) => {
            nethook.raw(PacketId.ModalFormResponse).on((ptr, _size, networkIdentifier, packetId) => {
                ptr.move(1);
                const formId = ptr.readVarUint();
                const rawData = ptr.readVarString();
                callback({ formId, rawData, networkIdentifier: getNetworkIdentifierAlias(networkIdentifier) });
            });
        },
    };
};

export const createConnectionsTrackingServiceDependencies = (): ConnectionsTrackingServiceDependencies => {
    return {
        onLogin: (callback) => {
            nethook.after(PacketId.Login).on((ptr, networkIdentifier, packetId) => {
                callback({
                    networkIdentifier: getNetworkIdentifierAlias(networkIdentifier),
                    xuid: ptr.connreq.cert.getXuid(),
                    username: ptr.connreq.cert.getIdentityName(),
                });
            });
        },
        onClose: (callback) => {
            NetworkIdentifier.close.on((networkIdentifier) => {
                callback({ networkIdentifier: getNetworkIdentifierAlias(networkIdentifier) });
            });
        },
    };
};

export const createCommandServiceDependencies = (connectionsTracking: ConnectionsTrackingServiceType): CommandServiceDependencyType => {

    return {
        onPlayerCommand: (callback) => {
            command.hook.on((cmd, originName) => {
                const { networkIdentifier } = connectionsTracking.getPlayerConnections().find(x => x.playerName === originName) ?? {};
                if (!networkIdentifier) { return; }

                callback({ command: cmd, networkIdentifier: networkIdentifier });
            });
        },
        onServerCommand: (callback) => {
            command.hook.on((cmd, originName) => {
                if (originName !== 'server') { return; }

                callback({ command: cmd });
            });
        },
    };
};

export const createServices = (): ServicesType => {

    const formsService = createFormsApi(createFormsApiDependencies());
    const connectionsService = createConnectionsTrackingService(createConnectionsTrackingServiceDependencies());
    const commandService = createCommandService(createCommandServiceDependencies(connectionsService));

    return {
        formsService,
        connectionsService,
        commandService,
    };
};