import * as colors from "colors";
import { bin } from "../bin";
import { capi } from "../capi";
import { CommandParameterType } from "../commandparam";
import { abstract } from "../common";
import { AllocatedPointer, StaticPointer, VoidPointer } from "../core";
import { CxxMap } from "../cxxmap";
import { CxxPair } from "../cxxpair";
import { CxxVector, CxxVectorToArray } from "../cxxvector";
import { makefunc } from "../makefunc";
import { AbstractClass, KeysFilter, nativeClass, NativeClass, NativeClassType, nativeField } from "../nativeclass";
import { bin64_t, bool_t, CommandParameterNativeType, CxxString, float32_t, int16_t, int32_t, int64_as_float_t, NativeType, Type, uint32_t, uint64_as_float_t, uint8_t, void_t } from "../nativetype";
import { Wrapper } from "../pointer";
import { CxxSharedPtr } from "../sharedpointer";
import { Singleton } from "../singleton";
import { templateName } from "../templatename";
import { getEnumKeys } from "../util";
import { Actor, ActorDefinitionIdentifier } from "./actor";
import { Block } from "./block";
import { BlockPos, Vec3 } from "./blockpos";
import { CommandSymbols } from "./cmdsymbolloader";
import { CommandOrigin } from "./commandorigin";
import { MobEffect } from "./effects";
import { HashedString } from "./hashedstring";
import { ItemStack } from "./inventory";
import { AvailableCommandsPacket } from "./packets";
import { Player } from "./player";
import { procHacker } from "./proc";
import { serverInstance } from "./server";
import { proc } from "./symbols";
import { HasTypeId, typeid_t, type_id } from "./typeid";

export enum CommandPermissionLevel {
	Normal,
	Operator,
	Host,
	Automation,
	Admin,
    Internal,
}

export enum CommandCheatFlag {
    Cheat,
    NotCheat = 0x40,
    /** @deprecated */
    NoCheat = 0x40,
    None = 0,
}

export enum CommandExecuteFlag {
    Allowed,
    Disallowed = 0x10,
}

export enum CommandSyncFlag {
    Synced,
    Local = 8,
}

export enum CommandTypeFlag {
    None,
    Message = 0x20,
}

export enum CommandUsageFlag {
    Normal,
    Test,
    /** @deprecated Use `CommandVisibilityFlag` */
    Hidden,
    _Unknown=0x80,
}

/** Putting in flag1 or flag2 are both ok, you can also combine with other flags like CommandCheatFlag.NoCheat | CommandVisibilityFlag.HiddenFromCommandBlockOrigin but combining is actually not quite useful */
export enum CommandVisibilityFlag {
    Visible,
    /** Bug: Besides from being hidden from command blocks, players cannot see it also well, but they are still able to execute */
    HiddenFromCommandBlockOrigin = 2,
    HiddenFromPlayerOrigin = 4,
    /** Still visible to console */
    Hidden = 6,
}

/** @deprecated **/
export const CommandFlag = CommandCheatFlag; // CommandFlag is actually a class

export enum SoftEnumUpdateType {
    Add,
    Remove,
    Replace,
}

@nativeClass()
export class MCRESULT extends NativeClass {
    @nativeField(uint32_t)
    result:uint32_t;

    getFullCode():number {
        abstract();
    }
    isSuccess():boolean {
        abstract();
    }
}
MCRESULT.prototype.getFullCode = procHacker.js("MCRESULT::getFullCode", int32_t, {this:MCRESULT});
MCRESULT.prototype.isSuccess = procHacker.js("MCRESULT::isSuccess", bool_t, {this:MCRESULT});

export enum CommandSelectionOrder {
    Sorted,
    InvertSorted,
    Random,
}

export enum CommandSelectionType {
    /** Used in @s */
    Self,
    /** Used in @e */
    Entities,
    /** Used in @a */
    Players,
    /** Used in @r */
    DefaultPlayers,
    /** Used in @c */
    OwnedAgent,
    /** Used in @v */
    Agents,
}

@nativeClass(0xc1, 8)
export class CommandSelectorBase extends AbstractClass {
    private _newResults(origin:CommandOrigin):CxxSharedPtr<CxxVector<Actor>> {
        abstract();
    }
    newResults<T extends Actor>(origin:CommandOrigin, typeFilter?:new(...args:any[])=>T):T[] {
        const list = this._newResults(origin);
        if (typeFilter != null) {
            const out:T[] = [];
            for (const actor of list.p!) {
                if (actor instanceof typeFilter) {
                    out.push(actor as T);
                }
            }
            list.dispose();
            return out;
        } else {
            const actors = list.p!.toArray();
            list.dispose();
            return actors as T[];
        }
    }
    getName():string {
        abstract();
    }
}

/** @param args_1 forcePlayer */
const CommandSelectorBaseCtor = procHacker.js('CommandSelectorBase::CommandSelectorBase', void_t, null, CommandSelectorBase, bool_t);
CommandSelectorBase.prototype[NativeType.dtor] = procHacker.js('CommandSelectorBase::~CommandSelectorBase', void_t, {this:CommandSelectorBase});
(CommandSelectorBase.prototype as any)._newResults = procHacker.js('CommandSelectorBase::newResults', CxxSharedPtr.make(CxxVector.make(Actor.ref())), {this:CommandSelectorBase, structureReturn: true}, CommandOrigin);
CommandSelectorBase.prototype.getName = procHacker.js('CommandSelectorBase::getName', CxxString, {this:CommandSelectorBase, structureReturn: true});

@nativeClass()
export class WildcardCommandSelector<T> extends CommandSelectorBase {
    static make<T>(type:Type<T>):NativeClassType<WildcardCommandSelector<T>> {
        return Singleton.newInstance(WildcardCommandSelector, type, ()=>{
            class WildcardCommandSelectorImpl extends WildcardCommandSelector<T> {
            }
            Object.defineProperty(WildcardCommandSelectorImpl, 'name', {value: templateName('WildcardCommandSelector', type.name)});
            WildcardCommandSelectorImpl.define({});

            return WildcardCommandSelectorImpl;
        });
    }
}
interface WildcardCommandSelectorType<T> extends NativeClassType<WildcardCommandSelector<T>> {
    [CommandParameterType.symbol]:true;
}
export const ActorWildcardCommandSelector = WildcardCommandSelector.make(Actor) as WildcardCommandSelectorType<Actor>;
ActorWildcardCommandSelector.prototype[NativeType.ctor] = function () {
    CommandSelectorBaseCtor(this, false);
};
export class PlayerWildcardCommandSelector extends ActorWildcardCommandSelector {
    [NativeType.ctor]():void {
        CommandSelectorBaseCtor(this, true);
    }
}

@nativeClass()
export class CommandSelector<T> extends CommandSelectorBase {
    static make<T>(type:Type<T>):NativeClassType<CommandSelector<T>> {
        return Singleton.newInstance(CommandSelector, type, ()=>{
            class CommandSelectorImpl extends CommandSelector<T> {
            }
            Object.defineProperty(CommandSelectorImpl, 'name', {value: templateName('CommandSelector', type.name)});
            CommandSelectorImpl.define({});

            return CommandSelectorImpl;
        });
    }
}
interface CommandSelectorType<T> extends NativeClassType<CommandSelector<T>> {
    [CommandParameterType.symbol]:true;
}
export const ActorCommandSelector = CommandSelector.make(Actor) as CommandSelectorType<Actor>;
ActorCommandSelector.prototype[NativeType.ctor] = function () {
    CommandSelectorBaseCtor(this, false);
};
export const PlayerCommandSelector = CommandSelector.make(Player) as CommandSelectorType<Player>;
PlayerCommandSelector.prototype[NativeType.ctor] = function () {
    CommandSelectorBaseCtor(this, true);
};

@nativeClass()
export class CommandFilePath extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;

    @nativeField(CxxString)
    text:CxxString;
}

@nativeClass()
class CommandIntegerRange extends NativeClass { // Not exporting yet, not supported
    static readonly [CommandParameterType.symbol]:true;

    @nativeField(int32_t)
    min:int32_t;
    @nativeField(int32_t)
    max:int32_t;
    @nativeField(bool_t)
    inverted:bool_t;
}

@nativeClass()
export class CommandItem extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;

    @nativeField(int32_t)
    version:int32_t;
    @nativeField(int32_t)
    id:int32_t;

    createInstance(count:number):ItemStack {
        abstract();
    }
}

CommandItem.prototype.createInstance = procHacker.js('CommandItem::createInstance', ItemStack, {this:CommandItem, structureReturn:true}, int32_t);

export class CommandMessage extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;
    data:CxxVector<CommandMessage.MessageComponent>;

    getMessage(origin:CommandOrigin):string {
        abstract();
    }
}

export namespace CommandMessage {

    @nativeClass(0x28)
    export class MessageComponent extends NativeClass {
        @nativeField(CxxString)
        string:CxxString;
        @nativeField(ActorCommandSelector.ref())
        selection:WildcardCommandSelector<Actor>;
    }
}

CommandMessage.abstract({
    data: CxxVector.make(CommandMessage.MessageComponent),
}, 0x18);
CommandMessage.prototype.getMessage = procHacker.js('CommandMessage::getMessage', CxxString, {this:CommandMessage, structureReturn:true}, CommandOrigin);

@nativeClass()
export class CommandPosition extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;
    @nativeField(float32_t)
    x:float32_t;
    @nativeField(float32_t)
    y:float32_t;
    @nativeField(float32_t)
    z:float32_t;
    @nativeField(bool_t)
    isXRelative:bool_t;
    @nativeField(bool_t)
    isYRelative:bool_t;
    @nativeField(bool_t)
    isZRelative:bool_t;
    @nativeField(bool_t)
    local:bool_t;

    static create(x:number, isXRelative:boolean, y:number, isYRelative:boolean, z:number, isZRelative:boolean, local:boolean):CommandPosition {
        const ret = new CommandPosition(true);
        ret.x = x;
        ret.y = y;
        ret.z = z;
        ret.isXRelative = isXRelative;
        ret.isYRelative = isYRelative;
        ret.isZRelative = isZRelative;
        ret.local = local;
        return ret;
    }

    protected _getPosition(origin: CommandOrigin, offsetFromBase: Vec3): Vec3 {
        abstract();
    }
    getPosition(origin: CommandOrigin, offsetFromBase: Vec3 = Vec3.create(0, 0, 0)): Vec3 {
        return this._getPosition(origin, offsetFromBase);
    }
    protected _getBlockPosition(origin: CommandOrigin, offsetFromBase: Vec3): BlockPos {
        abstract();
    }
    getBlockPosition(origin: CommandOrigin, offsetFromBase: Vec3 = Vec3.create(0, 0, 0)): BlockPos {
        return this._getBlockPosition(origin, offsetFromBase);
    }
}
(CommandPosition.prototype as any)._getPosition = procHacker.js("?getPosition@CommandPosition@@QEBA?AVVec3@@AEBVCommandOrigin@@AEBV2@@Z", Vec3, { this:CommandPosition,structureReturn:true }, CommandOrigin, Vec3);
(CommandPosition.prototype as any)._getBlockPosition = procHacker.js("?getBlockPos@CommandPosition@@QEBA?AVBlockPos@@AEBVCommandOrigin@@AEBVVec3@@@Z", BlockPos, { this:CommandPosition,structureReturn:true }, CommandOrigin, Vec3);

@nativeClass()
export class CommandPositionFloat extends CommandPosition {
    static readonly [CommandParameterType.symbol]: true;

    static create(x:number, isXRelative:boolean, y:number, isYRelative:boolean, z:number, isZRelative:boolean, local:boolean):CommandPositionFloat {
        const ret = CommandPosition.construct();
        ret.x = x;
        ret.y = y;
        ret.z = z;
        ret.isXRelative = isXRelative;
        ret.isYRelative = isYRelative;
        ret.isZRelative = isZRelative;
        ret.local = local;
        return ret;
    }
}

@nativeClass()
export class CommandRawText extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;

    @nativeField(CxxString)
    text:CxxString;
}

@nativeClass()
export class CommandWildcardInt extends NativeClass {
    static readonly [CommandParameterType.symbol]:true;

    @nativeField(bool_t)
    isWildcard:bool_t;
    @nativeField(int32_t)
    value:int32_t;
}

// It is a special enum that cannot be used in `command.enum`, it is just a uint8_t.
// However, it might be confusing with only numbers, so I tried to create some methods for it.
// @nativeClass()
// export class CommandOperator extends NativeClass {
//     static readonly [CommandParameterType.symbol]:true;
//     static readonly symbol = 'enum CommandOperator';

//     @nativeField(uint8_t)
//     value:uint8_t;

//     toString(): string {
//         switch (this.value) {
//         case 1: return '=';
//         case 2: return '+=';
//         case 3: return '-=';
//         case 4: return '*=';
//         case 5: return '/=';
//         case 6: return '%=';
//         case 7: return '<';
//         case 8: return '>';
//         case 9: return '><';
//         default: return "invalid";
//         }
//     }

//     valueOf():number {
//         return this.value;
//     }
// }

@nativeClass(0x30)
export class CommandContext extends NativeClass {
    @nativeField(CxxString)
    command:CxxString;
    @nativeField(CommandOrigin.ref())
    origin:CommandOrigin;

    /**
     * @param commandOrigin it's destructed by the destruction of CommandContext
     */
    static constructSharedPtr(command:string, commandOrigin:CommandOrigin):CxxSharedPtr<CommandContext> {
        const sharedptr = new CommandContextSharedPtr(true);
        sharedptr.create(commandContextRefCounter$Vftable);
        CommandContext$CommandContext(sharedptr.p, command, CommandOriginWrapper.create(commandOrigin), commandVersion);
        return sharedptr;
    }
}

const CommandOriginWrapper = Wrapper.make(CommandOrigin.ref());
const commandContextRefCounter$Vftable = proc["std::_Ref_count_obj2<CommandContext>::`vftable'"];
const commandVersion = proc['CommandVersion::CurrentVersion'].getInt32();
const CommandContext$CommandContext = procHacker.js('CommandContext::CommandContext', void_t, null,
    CommandContext, CxxString, CommandOriginWrapper, int32_t);
const CommandContextSharedPtr = CxxSharedPtr.make(CommandContext);

export enum CommandOutputType {
    None = 0,
    LastOutput = 1,
    Silent = 2,
    Type3 = 3, // user / server console / command block
    ScriptEngine = 4,
}

type CommandOutputParameterType = string|boolean|number|Actor|BlockPos|Vec3|Actor[];

@nativeClass(0x28)
export class CommandOutputParameter extends NativeClass {
    @nativeField(CxxString)
    string:CxxString;
    @nativeField(int32_t)
    count:int32_t;
    static create(input:CommandOutputParameterType, count?:number):CommandOutputParameter {
        const out = CommandOutputParameter.construct();
        switch (typeof input) {
        case 'string':
            out.string = input;
            out.count = count ?? 0;
            break;
        case 'boolean':
            out.string = input.toString();
            out.count = 0;
            break;
        case 'number':
            if (Number.isInteger(input)) {
                out.string = input.toString();
            } else {
                out.string = input.toFixed(2).toString();
            }
            out.count = 0;
            break;
        case 'object':
            if (input instanceof Actor) {
                out.string = input.getName();
                out.count = 1;
            } else if (input instanceof BlockPos || input instanceof Vec3) {
                out.string = `${input.x}, ${input.y}, ${input.z}`;
                out.count = count ?? 0;
            } else if (Array.isArray(input)) {
                if (input.length > 0) {
                    if (input[0] instanceof Actor) {
                        out.string = input.map(e => e.getName()).join(', ');
                        out.count = input.length;
                    }
                }
            }
            break;
        default:
            out.string = '';
            out.count = -1;
        }
        return out;
    }
}

@nativeClass(0x30)
export class CommandOutput extends NativeClass {
    getSuccessCount():number {
        abstract();
    }
    getType():CommandOutputType {
        abstract();
    }
    constructAs(type:CommandOutputType):void {
        abstract();
    }
    empty():boolean {
        abstract();
    }
    protected _successNoMessage():void {
        abstract();
    }
    protected _success(message:string, params:CxxVector<CommandOutputParameter>):void {
        abstract();
    }
    success(message?:string, params:CommandOutputParameterType[]|CommandOutputParameter[] = []):void {
        if (message === undefined) {
            this._successNoMessage();
        } else {
            const _params = (CxxVector.make(CommandOutputParameter)).construct();
            if (params.length) {
                if (params[0] instanceof CommandOutputParameter) {
                    for (const param of params as CommandOutputParameter[]) {
                        _params.push(param);
                        param.destruct();
                    }
                } else {
                    for (const param of params as CommandOutputParameterType[]) {
                        const _param = CommandOutputParameter.create(param);
                        _params.push(_param);
                        _param.destruct();
                    }
                }
            }
            this._success(message, _params);
            _params.destruct();
        }
    }
    protected _error(message:string, params:CxxVector<CommandOutputParameter>):void {
        abstract();
    }
    error(message:string, params:CommandOutputParameterType[]|CommandOutputParameter[] = []):void {
        const _params = (CxxVector.make(CommandOutputParameter)).construct();
        if (params.length) {
            if (params[0] instanceof CommandOutputParameter) {
                for (const param of params as CommandOutputParameter[]) {
                    _params.push(param);
                    param.destruct();
                }
            } else {
                for (const param of params as CommandOutputParameterType[]) {
                    const _param = CommandOutputParameter.create(param);
                    _params.push(_param);
                    _param.destruct();
                }
            }
        }
        this._error(message, _params);
        _params.destruct();
    }
    protected _addMessage(message:string, params:CxxVector<CommandOutputParameter>):void {
        abstract();
    }
    addMessage(message:string, params:CommandOutputParameterType[]|CommandOutputParameter[] = []):void {
        const _params = (CxxVector.make(CommandOutputParameter)).construct();
        if (params.length) {
            if (params[0] instanceof CommandOutputParameter) {
                for (const param of params as CommandOutputParameter[]) {
                    _params.push(param);
                    param.destruct();
                }
            } else {
                for (const param of params as CommandOutputParameterType[]) {
                    const _param = CommandOutputParameter.create(param);
                    _params.push(_param);
                    _param.destruct();
                }
            }
        }
        this._addMessage(message, _params);
        _params.destruct();
    }
}

@nativeClass(null)
export class CommandOutputSender extends NativeClass {
    @nativeField(VoidPointer)
    vftable:VoidPointer;
}

@nativeClass(null)
export class MinecraftCommands extends NativeClass {
    @nativeField(VoidPointer)
    vftable:VoidPointer;
    @nativeField(CommandOutputSender.ref())
    sender:CommandOutputSender;
    handleOutput(origin:CommandOrigin, output:CommandOutput):void {
        abstract();
    }
    /**
     * @param ctx it's destructed by this function
     */
    executeCommand(ctx:CxxSharedPtr<CommandContext>, suppressOutput:boolean):MCRESULT {
        abstract();
    }
    getRegistry():CommandRegistry {
        abstract();
    }
    runCommand(command:HashedString, origin:CommandOrigin, ccVersion:number): void{
        abstract();
    }
}

export enum CommandParameterDataType { NORMAL, ENUM, SOFT_ENUM, POSTFIX }

export enum CommandParameterOption {
    None,
    EnumAutocompleteExpansion,
    HasSemanticConstraint,
}

@nativeClass()
export class CommandParameterData extends NativeClass {
    @nativeField(typeid_t)
    tid:typeid_t<CommandRegistry>;
    @nativeField(VoidPointer)
    parser:VoidPointer|null; // bool (CommandRegistry::*)(void *, CommandRegistry::ParseToken const &, CommandOrigin const &, int, std::string &,std::vector<std::string> &) const;
    @nativeField(CxxString)
    name:CxxString;

    /** @deprecated Use {@link enumNameOrPostfix} instead */
    @nativeField(VoidPointer, {ghost:true})
    desc:VoidPointer|null;
    @nativeField(VoidPointer)
    enumNameOrPostfix:VoidPointer|null; // char*

    /** @deprecated Use {@link enumOrPostfixSymbol} instead */
    @nativeField(int32_t, {ghost:true})
    unk56:int32_t;
    @nativeField(int32_t)
    enumOrPostfixSymbol:int32_t;

    @nativeField(int32_t)
    type:CommandParameterDataType;
    @nativeField(int32_t)
    offset:int32_t;
    @nativeField(int32_t)
    flag_offset:int32_t;
    @nativeField(bool_t)
    optional:bool_t;

    /** @deprecated Use {@link options} instead */
    @nativeField(bool_t, {ghost:true})
    pad73:bool_t;
    @nativeField(uint8_t)
    options:CommandParameterOption;
}

@nativeClass()
export class CommandVFTable extends NativeClass {
    @nativeField(VoidPointer)
    destructor:VoidPointer;
    @nativeField(VoidPointer)
    execute:VoidPointer|null;
}

@nativeClass()
class EnumResult extends NativeClass {
    @nativeField(int32_t, {ghost: true})
    intValue:int32_t;
    @nativeField(bin64_t, {ghost: true})
    bin64Value:bin64_t;
    @nativeField(int64_as_float_t, {ghost: true})
    int64Value:int64_as_float_t;
    @nativeField(CxxString)
    stringValue:CxxString;
    @nativeField(CxxString)
    token:CxxString;
}

function passNativeTypeCtorParams<T>(type:Type<T>):[
    number, number,
    (v:unknown)=>boolean,
    ((v:unknown)=>boolean)|undefined,
    (ptr:StaticPointer, offset?:number)=>T,
    (ptr:StaticPointer, v:T, offset?:number)=>void,
    (stackptr:StaticPointer, offset?:number)=>T|null,
    (stackptr:StaticPointer, param:T extends VoidPointer ? (T|null) : T, offset?:number)=>void,
    (ptr:StaticPointer)=>void,
    (ptr:StaticPointer)=>void,
    (to:StaticPointer, from:StaticPointer)=>void,
    (to:StaticPointer, from:StaticPointer)=>void,
] {
    if (NativeClass.isNativeClassType(type)) {
        return [
            type[NativeType.size],
            type[NativeType.align],
            v=>type.isTypeOf(v),
            v=>type.isTypeOfWeak(v),
            (ptr, offset)=>type[NativeType.getter](ptr, offset),
            (ptr, param, offset)=>type[NativeType.setter](ptr, param, offset),
            (stackptr, offset)=>type[makefunc.getFromParam](stackptr, offset),
            (stackptr, param, offset)=>type[makefunc.setToParam](stackptr, param, offset),
            ptr=>type[NativeType.ctor](ptr),
            ptr=>type[NativeType.dtor](ptr),
            (to, from)=>type[NativeType.ctor_copy](to, from),
            (to, from)=>type[NativeType.ctor_move](to, from),
        ];
    } else {
        return [
            type[NativeType.size],
            type[NativeType.align],
            type.isTypeOf,
            type.isTypeOfWeak,
            type[NativeType.getter],
            type[NativeType.setter],
            type[makefunc.getFromParam],
            type[makefunc.setToParam],
            type[NativeType.ctor],
            type[NativeType.dtor],
            type[NativeType.ctor_copy],
            type[NativeType.ctor_move],
        ];
    }
}

/**
 * The command parameter type with the type converter
 */
export abstract class CommandMappedValue<BaesType, NewType=BaesType> extends CommandParameterNativeType<BaesType> {
    constructor(type:Type<BaesType>, symbol:string = type.symbol || type.name, name:string = type.name) {
        super(symbol, name, ...passNativeTypeCtorParams(type));
    }

    abstract mapValue(value:BaesType):NewType;
}

abstract class CommandEnumBase<BaseType, NewType> extends CommandMappedValue<BaseType, NewType> {
    getParser(): VoidPointer {
        return new VoidPointer;
    }
}

export abstract class CommandEnum<V> extends CommandEnumBase<EnumResult, V> {
    constructor(symbol:string, name?:string) {
        super(EnumResult, symbol, name || symbol);
    }
}

/**
 * built-in enum wrapper
 * one instance per one enum
 */
export class CommandRawEnum extends CommandEnum<string|number> {
    private static readonly all = new Map<string, CommandRawEnum>();

    private readonly registry = serverInstance.minecraft.getCommands().getRegistry();
    private enumIndex = -1;
    private idRegistered = false;
    private parserType:ParserType = ParserType.Int;

    public isBuiltInEnum = false;

    private constructor(public readonly name:string) {
        super(name, name);
        if (CommandRawEnum.all.has(name)) throw Error(`the enum parser already exists (name=${name})`);
        this._update();
        this.isBuiltInEnum = this.enumIndex !== -1;
    }

    private _update():boolean {
        if (this.enumIndex !== -1) return true; // already hooked
        const enumIdex = this.registry.enumLookup.get(this.name);
        if (enumIdex === null) return false;
        this.enumIndex = enumIdex;

        const enumobj = this.registry.enums.get(this.enumIndex)!;
        this.parserType = getParserType(enumobj.parser);

        // hook the enum parser, provides extra information.
        const original = makefunc.js(enumobj.parser, bool_t, null, CommandRegistry, EnumResult, StaticPointer, CommandOrigin, int32_t, CxxString, CxxVector.make(CxxString));
        enumobj.parser = makefunc.np((registry, storage, tokenPtr, origin, version, error, errorParams) => {
            const ret = original(registry, storage, tokenPtr, origin, version, error, errorParams);

            const token = tokenPtr.getPointerAs(CommandRegistry.ParseToken);
            storage.token = token.getText();
            return ret;
        }, bool_t, null, CommandRegistry, EnumResult, StaticPointer, CommandOrigin.ref(), int32_t, CxxString, CxxVector.make(CxxString));
        return true;
    }

    addValues(values:string[]):void {
        const id = this.registry.addEnumValues(this.name, values);
        if (!this.idRegistered) {
            this.idRegistered = true;
            type_id.register(CommandRegistry, this, id);
        }
        if (!this._update()) {
            throw Error(`enum parser is not generated (name=${this.name})`);
        }
    }

    getValues():string[] {
        const values = new Array<string>();
        if (this.enumIndex === -1) return values;
        const enumobj = this.registry.enums.get(this.enumIndex)!;
        for (const {first: valueIndex} of enumobj.values) {
            values.push(this.registry.enumValues.get(valueIndex));
        }
        return values;
    }

    getValueCount():number {
        if (this.enumIndex === -1) return 0;
        const enumobj = this.registry.enums.get(this.enumIndex)!;
        return enumobj.values.size();
    }

    mapValue(value:EnumResult):string|number {
        switch (this.parserType) {
        case ParserType.Unknown: return value.token.toLowerCase();
        case ParserType.Int: return value.intValue;
        case ParserType.String: return value.stringValue;
        }
    }

    static getInstance(name:string):CommandRawEnum {
        let parser = CommandRawEnum.all.get(name);
        if (parser != null) return parser;
        parser = new CommandRawEnum(name);
        CommandRawEnum.all.set(name, parser);
        return parser;
    }
}

class CommandMappedEnum<V extends string|number|symbol> extends CommandEnum<V> {
    public readonly mapper = new Map<string, V>();
    private raw:CommandRawEnum;

    protected _init():void {
        const keys = [...this.mapper.keys()];
        for (const value of keys) {
            if (value === "") throw Error(`${value}: enum value cannot be empty`); // It will be ignored by CommandRegistry::addEnumValues if it is empty

            /*
                Allowed special characters:
                - (
                - )
                - -
                - .
                - ?
                - _
                and the ones whose ascii code is bigger than 127, like §, ©, etc.
            */
            const regex = /[ -'*-,/:->@[-^`{-~]/g;
            let invalidCharacters = '';
            let matched:RegExpExecArray|null;
            while ((matched = regex.exec(value)) !== null) {
                invalidCharacters += matched[0];
            }
            if (invalidCharacters !== '') throw Error(`${value}: enum value contains invalid characters (${invalidCharacters})`);
        }

        this.raw = CommandRawEnum.getInstance(this.name);
        this.raw.addValues(keys);
        if (this.raw.isBuiltInEnum) {
            console.error(colors.yellow(`Warning, built-in enum is extended(name = ${this.name})`));
        }
    }

    mapValue(value:EnumResult):V {
        // it can return the undefined value if it overlaps the raw enum.
        return this.mapper.get(value.token.toLocaleLowerCase())!;
    }
}

export class CommandStringEnum<T extends string[]> extends CommandMappedEnum<T[number]> {
    public readonly values:T;

    constructor(name:string, ...values:T) {
        super(name);
        this.values = values;

        for (const value of values) {
            const lower = value.toLocaleLowerCase();
            if (this.mapper.has(lower)) {
                throw Error(`${value}: enum value duplicated`);
            }
            this.mapper.set(lower, value);
        }
        this._init();
    }
}

export class CommandIndexEnum<T extends number|string> extends CommandMappedEnum<T> {
    public readonly enum:Record<string, T>;
    constructor(name:string, enumType:Record<string, T>) {
        super(name);
        this.enum = enumType;

        for (const key of getEnumKeys(enumType)) {
            const lower = key.toLocaleLowerCase();
            if (this.mapper.has(lower)) {
                throw Error(`${key}: enum value duplicated`);
            }
            this.mapper.set(lower, enumType[key]);
        }
        this._init();
    }
}

export class CommandSoftEnum extends CommandEnumBase<CxxString, string> {
    private static readonly all = new Map<string, CommandSoftEnum>();

    private readonly registry = serverInstance.minecraft.getCommands().getRegistry();
    private enumIndex = -1;

    private constructor(name:string) {
        super(CxxString, CxxString.symbol, name);
        if (CommandSoftEnum.all.has(name)) throw Error(`the enum parser already exists (name=${name})`);
        this.enumIndex = this.registry.softEnumLookup.get(this.name) ?? -1;
        // No type id should be registered, it is the type of string
    }

    protected updateValues(mode: SoftEnumUpdateType, values:string[]):void {
        this.registry.updateSoftEnum(mode, this.name, values);
    }

    getParser(): VoidPointer {
        return CommandRegistry.getParser(CxxString);
    }

    mapValue(value:string):string {
        return value;
    }

    addValues(...values:string[]):void;
    addValues(values:string[]):void;
    addValues(...values:(string|string[])[]):void {
        const first = values[0];
        if (Array.isArray(first)) {
            values = first;
        }
        if (this.enumIndex === -1) {
            this.registry.addSoftEnum(this.name, values as string[]);
            this.enumIndex = this.registry.softEnumLookup.get(this.name) ?? -1;
        } else {
            this.updateValues(SoftEnumUpdateType.Add, values as string[]);
        }
    }

    removeValues(...values:string[]):void;
    removeValues(values:string[]):void;
    removeValues(...values:(string|string[])[]):void {
        const first = values[0];
        if (Array.isArray(first)) {
            this.updateValues(SoftEnumUpdateType.Remove, first);
        } else {
            this.updateValues(SoftEnumUpdateType.Remove, values as string[]);
        }
    }

    setValues(...values:string[]):void;
    setValues(values:string[]):void;
    setValues(...values:(string|string[])[]):void {
        const first = values[0];
        if (Array.isArray(first)) {
            values = first;
        }
        if (this.enumIndex !== -1) {
            this.registry.addSoftEnum(this.name, values as string[]);
            this.enumIndex = this.registry.softEnumLookup.get(this.name) ?? -1;
        } else {
            this.updateValues(SoftEnumUpdateType.Replace, values as string[]);
        }
    }

    getValues():string[] {
        const values = new Array<string>();
        if (this.enumIndex === -1) return values;
        const enumobj = this.registry.softEnums.get(this.enumIndex)!;
        return enumobj.list.toArray();
    }

    getValueCount():number {
        if (this.enumIndex === -1) return 0;
        const enumobj = this.registry.softEnums.get(this.enumIndex)!;
        return enumobj.list.size();
    }

    static getInstance(name:string):CommandSoftEnum {
        let parser = CommandSoftEnum.all.get(name);
        if (parser != null) return parser;
        parser = new CommandSoftEnum(name);
        CommandSoftEnum.all.set(name, parser);
        return parser;
    }
}

const parsers = new Map<Type<any>, VoidPointer>();
let enumParser: VoidPointer;

enum ParserType {
    Unknown,
    Int,
    String,
}

function getParserType(parser:VoidPointer):ParserType {
    if (parser.equals(CommandRegistry.getParser(CxxString))) {
        return ParserType.String;
    } else if (parser.equals(enumParser)) {
        return ParserType.Int;
    } else {
        return ParserType.Unknown;
    }
}

export class CommandRegistry extends HasTypeId {
    enumValues:CxxVector<CxxString>;
    enums:CxxVector<CommandRegistry.Enum>;
    enumLookup:CxxMap<CxxString, uint32_t>;
    enumValueLookup:CxxMap<CxxString, uint64_as_float_t>;
    commandSymbols:CxxVector<CommandRegistry.Symbol>;
    signatures:CxxMap<CxxString, CommandRegistry.Signature>;
    softEnums:CxxVector<CommandRegistry.SoftEnum>;
    softEnumLookup:CxxMap<CxxString, uint32_t>;

    registerCommand(command:string, description:string, level:CommandPermissionLevel, flag1:CommandCheatFlag|CommandVisibilityFlag, flag2:CommandUsageFlag|CommandVisibilityFlag):void {
        abstract();
    }
    registerAlias(command:string, alias:string):void {
        abstract();
    }

    /**
     * this method will destruct all parameters in params
     */
    registerOverload(name:string, commandClass:{new():Command}, params:CommandParameterData[]):void {
        const cls = commandClass as NativeClassType<Command>;
        const size = cls[NativeType.size];
        if (!size) throw Error(`${cls.name}: size is not defined`);
        const allocator = makefunc.np((returnval:StaticPointer)=>{
            const ptr = capi.malloc(size);
            const cmd = ptr.as(cls);
            cmd.construct();

            returnval.setPointer(cmd);
            return returnval;
        }, StaticPointer, {name: `${name} command::allocator`}, StaticPointer);

        const sig = this.findCommand(name);
        if (sig === null) throw Error(`${name}: command not found`);
        const overload = CommandRegistry.Overload.construct();
        overload.commandVersion = bin.make64(1, 0x7fffffff);
        overload.allocator = allocator;
        overload.parameters.setFromArray(params);
        overload.commandVersionOffset = -1;
        sig.overloads.push(overload);
        this.registerOverloadInternal(sig, sig.overloads.back()!);
        overload.destruct();

        for (const param of params) {
            param.destruct();
        }
    }

    registerOverloadInternal(signature:CommandRegistry.Signature, overload: CommandRegistry.Overload):void{
        abstract();
    }

    findCommand(command:string):CommandRegistry.Signature|null {
        abstract();
    }

    protected _serializeAvailableCommands(pk:AvailableCommandsPacket):AvailableCommandsPacket {
        abstract();
    }

    serializeAvailableCommands():AvailableCommandsPacket {
        const pk = AvailableCommandsPacket.allocate();
        this._serializeAvailableCommands(pk);
        return pk;
    }

    static getParser<T>(type:Type<T>):VoidPointer {
        if (type instanceof CommandEnumBase) {
            return type.getParser();
        }
        const parser = parsers.get(type);
        if (parser != null) return parser;
        throw Error(`${type.name} parser not found`);
    }

    static hasParser<T>(type:Type<T>):boolean {
        if (type instanceof CommandEnumBase) return true;
        return parsers.has(type);
    }

    static loadParser(symbols:CommandSymbols):void {
        for (const [type, addr] of symbols.iterateParsers()) {
            parsers.set(type, addr);
        }
        enumParser = symbols.enumParser;
    }

    static setParser(type:Type<any>, parserFnPointer:VoidPointer):void {
        parsers.set(type, parserFnPointer);
    }

    static setEnumParser(parserFnPointer:VoidPointer):void {
        enumParser = parserFnPointer;
    }

    hasEnum(name:string):boolean {
        return this.enumLookup.has(name);
    }

    getEnum(name:string):CommandRegistry.Enum|null {
        const enumIndex = this.enumLookup.get(name);
        if (enumIndex === null) return null;
        return this.enums.get(enumIndex);
    }

    addEnumValues(name:string, values:string[]):number {
        abstract();
    }

    getEnumValues(name:string):string[]|null {
        const values = new Array<string>();
        const _enum = this.getEnum(name);
        if (!_enum) return null;
        for (const {first: valueIndex} of _enum.values) {
            values.push(this.enumValues.get(valueIndex));
        }
        return values;
    }

    hasSoftEnum(name:string):boolean {
        return this.softEnumLookup.has(name);
    }

    getSoftEnum(name:string):CommandRegistry.SoftEnum|null {
        const enumIndex = this.softEnumLookup.get(name);
        if (enumIndex == null) return null;
        return this.softEnums.get(enumIndex);
    }

    addSoftEnum(name:string, values:string[]):number {
        abstract();
    }

    getSoftEnumValues(name:string):string[]|null {
        const _enum = this.getSoftEnum(name);
        if (!_enum) return null;
        return _enum.list.toArray();
    }

    updateSoftEnum(type:SoftEnumUpdateType, name:string, values:string[]):void {
        CommandSoftEnumRegistry$updateSoftEnum(this, type, name, values);
    }
}

export namespace CommandRegistry {
    @nativeClass()
    export class Symbol extends NativeClass {
        @nativeField(int32_t)
        value:int32_t;
    }

    @nativeClass(0x48)
    export class Overload extends NativeClass {
        @nativeField(bin64_t)
        commandVersion:bin64_t;
        @nativeField(VoidPointer)
        allocator:VoidPointer;
        @nativeField(CxxVector.make(CommandParameterData))
        parameters:CxxVector<CommandParameterData>;
        @nativeField(int32_t)
        commandVersionOffset:int32_t;
        /** @deprecated */
        @nativeField(int32_t, 0x28)
        u6:int32_t;
        @nativeField(CxxVector.make(CommandRegistry.Symbol))
        symbols:CxxVector<CommandRegistry.Symbol>;
    }

    @nativeClass(null)
    export class Signature extends NativeClass {
        @nativeField(CxxString)
        command:CxxString;
        @nativeField(CxxString)
        description:CxxString;
        @nativeField(CxxVector.make<CommandRegistry.Overload>(CommandRegistry.Overload))
        overloads:CxxVector<Overload>;
        @nativeField(int32_t)
        permissionLevel:CommandPermissionLevel;
        @nativeField(CommandRegistry.Symbol)
        commandSymbol:CommandRegistry.Symbol;
        @nativeField(CommandRegistry.Symbol)
        commandAliasEnum:CommandRegistry.Symbol;
        @nativeField(int32_t)
        flags:CommandCheatFlag|CommandExecuteFlag|CommandSyncFlag|CommandTypeFlag|CommandUsageFlag|CommandVisibilityFlag;
    }

    @nativeClass(null)
    export class ParseToken extends NativeClass {
        @nativeField(StaticPointer, 0x18)
        text:StaticPointer;
        @nativeField(uint32_t)
        length:uint32_t;
        @nativeField(CommandRegistry.Symbol)
        type:CommandRegistry.Symbol;

        getText():string {
            return this.text.getString().slice(0, this.length);
        }
    }

    @nativeClass()
    export class Enum extends NativeClass {
        @nativeField(CxxString)
        name:CxxString;
        @nativeField(typeid_t)
        tid:typeid_t<CommandRegistry>;
        @nativeField(VoidPointer)
        parser:VoidPointer;
        @nativeField(CxxVector.make(CxxPair.make(uint64_as_float_t, bin64_t)))
        values:CxxVector<CxxPair<uint64_as_float_t, bin64_t>>;
    }

    @nativeClass()
    export class SoftEnum extends NativeClass {
        @nativeField(CxxString)
        name:CxxString;
        @nativeField(CxxVector.make(CxxString))
        list:CxxVector<CxxString>;
    }
}

@nativeClass()
export class Command extends NativeClass {
    @nativeField(CommandVFTable.ref())
    vftable:CommandVFTable; // 0x00

    /** @deprecated */
    @nativeField(int32_t, {ghost:true})
    u1:int32_t; // 0x08
    @nativeField(int32_t)
    version:int32_t; // 0x08

    /** @deprecated */
    @nativeField(VoidPointer, {ghost:true})
    u2:VoidPointer|null; // 0x10
    @nativeField(CommandRegistry.ref())
    registry:CommandRegistry|null; // 0x10

    /** @deprecated */
    @nativeField(int32_t, {ghost:true})
    u3:int32_t; // 0x18
    @nativeField(int32_t)
    commandSymbol:int32_t; // 0x18

    /** @deprecated */
    @nativeField(int16_t, {ghost:true})
    u4:int16_t; // 0x1c
    @nativeField(int16_t)
    permissionLevel:int16_t; // 0x1c

    // IDA also shows this field but it seems everything has been working well without it, so I'm not sure if it's needed
    // @nativeField(uint8_t)
    // flags:uint8_t; // 0x1e

    [NativeType.ctor]():void {
        this.vftable = null as any;
        this.version = 0;
        this.registry = null;
        this.commandSymbol = -1;
        this.permissionLevel = 5;
        // this.flags = 0;
    }

    static mandatory<CMD extends Command,
        KEY extends keyof CMD,
        KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
        this:{new():CMD},
        key:KEY,
        keyForIsSet:KEY_ISSET,
        enumNameOrPostfix?:string|null,
        type:CommandParameterDataType = CommandParameterDataType.NORMAL,
        name:string = key as string,
        options:CommandParameterOption = CommandParameterOption.None):CommandParameterData {
        const cmdclass = this as NativeClassType<any>;
        const paramType = cmdclass.typeOf(key as string);
        const offset = cmdclass.offsetOf(key as string);
        const flag_offset = keyForIsSet !== null ? cmdclass.offsetOf(keyForIsSet as string) : -1;
        return Command.manual(name, paramType, offset, flag_offset, false, enumNameOrPostfix, type, options);
    }
    static optional<CMD extends Command,
        KEY extends keyof CMD,
        KEY_ISSET extends KeysFilter<CMD, bool_t>|null>(
        this:{new():CMD},
        key:KEY,
        keyForIsSet:KEY_ISSET,
        enumNameOrPostfix?:string|null,
        type:CommandParameterDataType = CommandParameterDataType.NORMAL,
        name:string = key as string,
        options:CommandParameterOption = CommandParameterOption.None):CommandParameterData {
        const cmdclass = this as NativeClassType<any>;
        const paramType = cmdclass.typeOf(key as string);
        const offset = cmdclass.offsetOf(key as string);
        const flag_offset = keyForIsSet !== null ? cmdclass.offsetOf(keyForIsSet as string) : -1;
        return Command.manual(name, paramType, offset, flag_offset, true, enumNameOrPostfix, type, options);
    }
    static manual(
        name:string,
        paramType:Type<any>,
        offset:number,
        flag_offset:number = -1,
        optional:boolean = false,
        enumNameOrPostfix?:string|null,
        type:CommandParameterDataType = CommandParameterDataType.NORMAL,
        options:CommandParameterOption = CommandParameterOption.None):CommandParameterData {
        const param = CommandParameterData.construct();
        param.tid.id = type_id(CommandRegistry, paramType).id;
        if (paramType instanceof CommandEnum) {
            if (enumNameOrPostfix != null) throw Error(`CommandEnum does not support postfix`);
            enumNameOrPostfix = paramType.name;
        } else if (paramType instanceof CommandSoftEnum) {
            // a soft enum is a string with autocompletions, for example, objectives in /scoreboard
            if (enumNameOrPostfix != null) throw Error(`CommandSoftEnum does not support postfix`);
            enumNameOrPostfix = paramType.name;
        } else {
            if (enumNameOrPostfix) {
                if (paramType === int32_t) {
                    type = CommandParameterDataType.POSTFIX;
                } else {
                    console.error(colors.yellow(`${paramType.name} does not support postfix`));
                    enumNameOrPostfix = null;
                }
            }
        }
        param.parser = CommandRegistry.getParser(paramType);
        param.name = name;
        param.type = type;
        param.enumNameOrPostfix = enumNameOrPostfix != null ? AllocatedPointer.fromString(enumNameOrPostfix) : null;

        param.enumOrPostfixSymbol = -1;
        param.offset = offset;
        param.flag_offset = flag_offset;
        param.optional = optional;
        param.options = options;
        return param;
    }

    static isWildcard(selectorBase: CommandSelectorBase): boolean {
        abstract();
    }
}
Command.isWildcard = procHacker.js("?isWildcard@Command@@KA_NAEBVCommandSelectorBase@@@Z", bool_t, null, CommandSelectorBase);

const BlockClass = Block;
const MobEffectClass = MobEffect;
const ActorDefinitionIdentifierClass = ActorDefinitionIdentifier;

function constptr<T extends NativeClass>(cls:new()=>T):CommandParameterNativeType<T> {
    const nativecls = cls as NativeClassType<T>;
    const constptr = Object.create(nativecls.ref());
    constptr.name = nativecls.name + '*';
    constptr.symbol = (nativecls.symbol || nativecls.name) + ' const * __ptr64';
    return constptr!;
}

export namespace Command {
    export const VFTable = CommandVFTable;
    export type VFTable = CommandVFTable;

    export const Block = constptr(BlockClass);
    export const MobEffect = constptr(MobEffectClass);
    export const ActorDefinitionIdentifier = constptr(ActorDefinitionIdentifierClass);
}
/** @deprecated use Command.Block */
export const CommandBlock = Command.Block;
/** @deprecated use Command.MobEffect */
export const CommandMobEffect = Command.MobEffect;

CommandOutput.prototype.getSuccessCount = procHacker.js('CommandOutput::getSuccessCount', int32_t, {this:CommandOutput});
CommandOutput.prototype.getType = procHacker.js('CommandOutput::getType', int32_t, {this:CommandOutput});
CommandOutput.prototype.constructAs = procHacker.js('??0CommandOutput@@QEAA@W4CommandOutputType@@@Z', void_t, {this:CommandOutput}, int32_t);
CommandOutput.prototype.empty = procHacker.js('CommandOutput::empty', bool_t, {this:CommandOutput});
(CommandOutput.prototype as any)._successNoMessage = procHacker.js('?success@CommandOutput@@QEAAXXZ', void_t, {this:CommandOutput});
(CommandOutput.prototype as any)._success = procHacker.js('?success@CommandOutput@@QEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEBV?$vector@VCommandOutputParameter@@V?$allocator@VCommandOutputParameter@@@std@@@3@@Z', void_t, {this:CommandOutput}, CxxString, CxxVector.make(CommandOutputParameter));
(CommandOutput.prototype as any)._error = procHacker.js('?error@CommandOutput@@QEAAXAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEBV?$vector@VCommandOutputParameter@@V?$allocator@VCommandOutputParameter@@@std@@@3@@Z', void_t, {this:CommandOutput}, CxxString, CxxVector.make(CommandOutputParameter));
(CommandOutput.prototype as any)._addMessage = procHacker.js('CommandOutput::addMessage', void_t, {this:CommandOutput}, CxxString, CxxVector.make(CommandOutputParameter));

MinecraftCommands.prototype.handleOutput = procHacker.js('MinecraftCommands::handleOutput', void_t, {this:MinecraftCommands}, CommandOrigin, CommandOutput);
// MinecraftCommands.prototype.executeCommand is defined at bdsx/command.ts
MinecraftCommands.prototype.getRegistry = procHacker.js('MinecraftCommands::getRegistry', CommandRegistry, {this:MinecraftCommands});

CommandRegistry.abstract({
    enumValues: [CxxVector.make(CxxString), 192],
    enums: [CxxVector.make(CommandRegistry.Enum), 216], // accessed in CommandRegistry::addEnumValuesToExisting
    enumLookup: [CxxMap.make(CxxString, uint32_t), 288],
    enumValueLookup: [CxxMap.make(CxxString, uint64_as_float_t), 304], // accessed in CommandRegistry::findEnumValue
    commandSymbols: [CxxVector.make(CommandRegistry.Symbol), 320], // accessed in CommandRegistry::findEnumValue
    signatures: [CxxMap.make(CxxString, CommandRegistry.Signature), 344], // accessed in CommandRegistry::findCommand
    softEnums: [CxxVector.make(CommandRegistry.SoftEnum), 488],
    softEnumLookup: [CxxMap.make(CxxString, uint32_t), 512],
});
CommandRegistry.prototype.registerOverloadInternal = procHacker.js('CommandRegistry::registerOverloadInternal', void_t, {this:CommandRegistry}, CommandRegistry.Signature, CommandRegistry.Overload);
CommandRegistry.prototype.registerCommand = procHacker.js('CommandRegistry::registerCommand', void_t, {this:CommandRegistry}, CxxString, makefunc.Utf8, int32_t, int32_t, int32_t);
CommandRegistry.prototype.registerAlias = procHacker.js('CommandRegistry::registerAlias', void_t, {this:CommandRegistry}, CxxString, CxxString);
CommandRegistry.prototype.findCommand = procHacker.js('CommandRegistry::findCommand', CommandRegistry.Signature, {this:CommandRegistry}, CxxString);
CommandRegistry.prototype.addEnumValues = procHacker.js('?addEnumValues@CommandRegistry@@QEAAHAEBV?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@AEBV?$vector@V?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@V?$allocator@V?$basic_string@DU?$char_traits@D@std@@V?$allocator@D@2@@std@@@2@@3@@Z', int32_t, {this:CommandRegistry}, CxxString, CxxVectorToArray.make(CxxString));
CommandRegistry.prototype.addSoftEnum = procHacker.js('CommandRegistry::addSoftEnum', int32_t, {this:CommandRegistry}, CxxString, CxxVectorToArray.make(CxxString));
(CommandRegistry.prototype as any)._serializeAvailableCommands = procHacker.js('CommandRegistry::serializeAvailableCommands', AvailableCommandsPacket, {this:CommandRegistry}, AvailableCommandsPacket);

// CommandSoftEnumRegistry is a class with only one field, which is a pointer to CommandRegistry.
// I can only find one member function so I am not sure if a dedicated class is needed.
const CommandSoftEnumRegistry$updateSoftEnum = procHacker.js('CommandSoftEnumRegistry::updateSoftEnum', void_t, null, CommandRegistry.ref().ref(), uint8_t, CxxString, CxxVectorToArray.make(CxxString));

// list for not implemented
'CommandRegistry::parse<AutomaticID<Dimension,int> >'; // CommandRegistry::parse<DimensionId>
'CommandRegistry::parse<CommandIntegerRange>'; // Not supported yet(?) there is no type id for it
'CommandRegistry::parse<std::unique_ptr<Command,struct std::default_delete<Command> > >';
'CommandRegistry::parse<AgentCommand::Mode>';
'CommandRegistry::parse<AgentCommands::CollectCommand::CollectionSpecification>';
'CommandRegistry::parse<AgentCommands::Direction>';
'CommandRegistry::parse<AnimationMode>';
'CommandRegistry::parse<AreaType>';
'CommandRegistry::parse<BlockSlot>';
'CommandRegistry::parse<CodeBuilderCommand::Action>';
'CommandRegistry::parse<CommandOperator>';
'CommandRegistry::parse<Enchant::Type>';
'CommandRegistry::parse<EquipmentSlot>';
'CommandRegistry::parse<GameType>';
'CommandRegistry::parse<Mirror>';
'CommandRegistry::parse<ObjectiveSortOrder>';
'CommandRegistry::parse<Rotation>';
