import { bool_t, CxxString, float32_t, int32_t } from "../nativetype";
import { RelativeFloat } from "./blockpos";
import { CommandSymbols } from "./cmdsymbolloader";
import { ActorCommandSelector, ActorWildcardCommandSelector, Command, CommandFilePath, CommandItem, CommandMessage, CommandPosition, CommandPositionFloat, CommandRawText, CommandRegistry, CommandWildcardInt, PlayerCommandSelector, PlayerWildcardCommandSelector } from "./command";
import { JsonValue } from "./connreq";
import { type_id } from "./typeid";

/**
 * types for the command parameter parser
 */
const types = [
    int32_t,
    float32_t,
    bool_t,
    CxxString,
    ActorWildcardCommandSelector,
    ActorCommandSelector,
    PlayerCommandSelector,
    RelativeFloat,
    CommandFilePath,
    // CommandIntegerRange,
    CommandItem,
    CommandMessage,
    CommandPosition,
    CommandPositionFloat,
    CommandRawText,
    CommandWildcardInt,
    // CommandOperator,
    JsonValue,
    Command.Block,
    Command.MobEffect,
];
const typesWithTypeIdPtr = [
    Command.ActorDefinitionIdentifier,
];

const symbols = new CommandSymbols;
symbols.addParserSymbols(types);
symbols.addParserSymbols(typesWithTypeIdPtr);
symbols.addCounterSymbol(CommandRegistry);
symbols.addTypeIdFnSymbols(CommandRegistry, types);
symbols.addTypeIdPtrSymbols(CommandRegistry, typesWithTypeIdPtr);
symbols.load();
type_id.load(symbols);
CommandRegistry.loadParser(symbols);
type_id.clone(CommandRegistry, ActorWildcardCommandSelector, PlayerWildcardCommandSelector);
CommandRegistry.setParser(PlayerWildcardCommandSelector, CommandRegistry.getParser(ActorWildcardCommandSelector)!);
