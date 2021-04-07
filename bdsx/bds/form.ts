import { MinecraftPacketIds, nethook, NetworkIdentifier } from "bdsx";
import { SetTitlePacket, ShowModalFormPacket } from "./packets";

const formMaps = new Map<number, SentForm>();

// rua.kr: I could not find the internal form id counter, It seems BDS does not use the form.
//         But I set the minimum for the unexpected situation.
const MINIMUM_FORM_ID = 0x10000000;
const MAXIMUM_FORM_ID = 0x7fffffff; // 32bit signed integer maximum

let formIdCounter = MINIMUM_FORM_ID;

class SentForm {
    public readonly id: number;

    constructor(
        public readonly networkIdentifier:NetworkIdentifier,
        public readonly resolve: (data:FormResponse<any>)=>void,
        public readonly reject: (err:Error)=>void) {

        // allocate id without dupication
        for (;;) {
            const id = formIdCounter++;
            if (formIdCounter >= MAXIMUM_FORM_ID) formIdCounter = MINIMUM_FORM_ID;

            // logically it will enter the infinity loop when it fulled. but technically it will crash by out of memory before
            if (!formMaps.has(id)) {
                formMaps.set(id, this);
                this.id = id;
                break;
            }
        }
    }
}

export interface FormItemButton {
    text: string;
    image?: {
        type: "path" | "url",
        data: string,
    };
}

export interface FormItemLabel {
    type: 'label';
    text: string;
    image?: {
        type: "path" | "url",
        data: string,
    };
}

export interface FormItemToggle {
    type: 'toggle';
    text: string;
    default?:boolean;
}

export interface FormItemSlider {
    type: 'slider';
    text: string;
    min: number;
    max: number;
    step?: number;
    default?: number;
}

export interface FormItemStepSlider {
    type: 'step_slider';
    text: string;
    steps: string[];
    default?: number;
}

export interface FormItemDropdown {
    type: 'dropdown';
    text: string;
    options: string[];
    default?: number;
}

export interface FormItemInput {
    type: 'input';
    text: string;
    placeholder?: string;
    default?: string;
}

export type FormItem = FormItemLabel | FormItemToggle | FormItemSlider | FormItemStepSlider | FormItemDropdown | FormItemInput;

export type FormResponse<T extends FormData['type']> =
    T extends 'form' ? number|null :
    T extends 'modal' ? boolean :
    T extends 'custom_form' ? any[]|null :
    never;

export interface FormDataSimple {
    type: 'form';
    title: string;
    content: string;
    buttons: FormItemButton[];
}
export interface FormDataModal {
    type: 'modal';
    title: string;
    content: string;
    button1: string;
    button2: string;
}
export interface FormDataCustom {
    type: 'custom_form';
    title: string;
    content: FormItem[];
}
export type FormData = FormDataSimple | FormDataModal | FormDataCustom;

export class FormButton {
    text: string;
    image: {
        type: "path" | "url",
        data: string,
    };
    constructor(text: string, imageType?: "path" | "url", imagePath: string = "") {
        this.text = text;
        if (imageType) {
            this.image = {
                type: imageType,
                data: imagePath,
            };
        }
    }
}

class FormComponent {
    text: string;
    type: string;
    constructor(text: string) {
        this.text = text;
    }
}

export class FormLabel extends FormComponent implements FormItemLabel {
    readonly type = "label";
    constructor(text: string) {
        super(text);
    }
}

export class FormToggle extends FormComponent implements FormItemToggle {
    readonly type = "toggle";
    default: boolean;
    constructor(text: string, defaultValue?: boolean) {
        super(text);
        if (defaultValue) this.default = defaultValue;
    }
}

export class FormSlider extends FormComponent implements FormItemSlider {
    readonly type = "slider";
    min: number;
    max: number;
    step: number;
    default: number;
    constructor(text: string, min: number, max: number, step?: number, defaultValue?: number) {
        super(text);
        this.min = min;
        this.max = max;
        if (step) this.step = step;
        if (defaultValue) this.default = defaultValue;
    }
}

export class FormStepSlider extends FormComponent implements FormItemStepSlider {
    readonly type = "step_slider";
    steps: string[];
    default: number;
    constructor(text: string, steps: string[], defaultIndex?: number) {
        super(text);
        this.steps = steps;
        if (defaultIndex) this.default = defaultIndex;
    }
}

export class FormDropdown extends FormComponent implements FormItemDropdown {
    readonly type = "dropdown";
    options: string[];
    default: number;
    constructor(text: string, options: string[], defaultIndex?: number) {
        super(text);
        this.options = options;
        if (defaultIndex) this.default = defaultIndex;
    }
}

export class FormInput extends FormComponent implements FormItemInput {
    readonly type = "input";
    placeholder: string;
    default: string;
    constructor(text: string, placeholder?: string, defaultValue?: string) {
        super(text);
        if (placeholder) this.placeholder = placeholder;
        if (defaultValue) this.default = defaultValue;
    }
}

export class Form<DATA extends FormData> {
    protected externalLoading = false;
    labels: Map<number, string> = new Map<number, string>();
    response:any;

    constructor(public data:DATA) {
    }

    static sendTo<T extends FormData['type']>(target:NetworkIdentifier, data:FormData&{type:T}):Promise<FormResponse<T>> {
        return new Promise((resolve:(res:FormResponse<T>)=>void, reject)=>{
            const submitted = new SentForm(target, resolve, reject);
            const pk = ShowModalFormPacket.create();
            pk.id = submitted.id;
            pk.content = JSON.stringify(data);
            pk.sendTo(target);
            pk.dispose();

            const formdata:FormData = data;
            if (formdata.type === 'form') {
                if (formdata.buttons !== undefined) {
                    let externalLoading = false;
                    for (const button of formdata.buttons) {
                        if (button.image?.type === "url") externalLoading = true;
                    }

                    if (externalLoading) {
                        setTimeout(() => {
                            const pk = SetTitlePacket.create();
                            pk.sendTo(target);
                            pk.dispose();
                        }, 1000);
                    }
                }
            }
        });
    }

    sendTo(target:NetworkIdentifier, callback?: (form: Form<DATA>, networkIdentifier: NetworkIdentifier) => any):number {
        const submitted = new SentForm(target, res=>{
            if (callback === undefined) return;
            switch (this.data.type) {
            case "form":
                this.response = this.labels.get(res as any) || res;
                break;
            case "modal":
                this.response = res;
                break;
            case "custom_form":
                this.response = res;
                if (res !== null) {
                    for (const [index, label] of this.labels) {
                        (res as any)[label] = (res as any)[index];
                    }
                }
                break;
            }
            callback(this, target);
        }, err=>{
            throw err;
        });
        const pk = ShowModalFormPacket.create();
        pk.id = submitted.id;
        pk.content = JSON.stringify(this.data);
        pk.sendTo(target);
        pk.dispose();
        if (this.externalLoading) {
            setTimeout(() => {
                const pk = SetTitlePacket.create();
                pk.sendTo(target);
                pk.dispose();
            }, 1000);
        }
        return pk.id;
    }

    toJSON():FormData {
        return this.data;
    }
}

export class SimpleForm extends Form<FormDataSimple> {
    constructor(title = "", content = "", buttons: FormButton[] = []) {
        super({
            type: 'form',
            title,
            content,
            buttons
        });
        for (const button of buttons) {
            if (button.image?.type === "url") this.externalLoading = true;
        }
    }
    getTitle():string {
        return this.data.title;
    }
    setTitle(title:string):void {
        this.data.title = title;
    }
    getContent():string {
        return this.data.content;
    }
    setContent(content:string):void {
        this.data.content = content;
    }
    addButton(button: FormButton, label?: string):void {
        this.data.buttons!.push(button);
        if (button.image?.type === "url") this.externalLoading = true;
        if (label) this.labels.set(this.data.buttons!.length - 1, label);
    }
    getButton(indexOrLabel: string | number):FormButton | null {
        if (typeof indexOrLabel === "string") {
            for (const [index, label] of this.labels) {
                if (label === indexOrLabel) return this.data.buttons![index] as FormButton;
            }
        } else {
            return this.data.buttons![indexOrLabel] as FormButton;
        }
        return null;
    }
}

export class ModalForm extends Form<FormDataModal> {
    constructor(title = "", content = "") {
        super({
            type: 'modal',
            title,
            content,
            button1: '',
            button2: '',
        });
    }
    getTitle():string {
        return this.data.title;
    }
    setTitle(title:string):void {
        this.data.title = title;
    }
    getContent():string {
        return this.data.content as string;
    }
    setContent(content:string):void {
        this.data.content = content;
    }
    getButtonConfirm():string {
        return this.data.button1;
    }
    setButtonConfirm(text:string):void {
        this.data.button1 = text;
    }
    getButtonCancel():string {
        return this.data.button2;
    }
    setButtonCancel(text:string):void {
        this.data.button2 = text;
    }
}

export class CustomForm extends Form<FormDataCustom> {
    constructor(title = "", content: FormComponent[] = []) {
        super({
            type: 'custom_form',
            title,
            content: content as FormItem[]
        });
    }
    getTitle():string {
        return this.data.title;
    }
    setTitle(title:string):void {
        this.data.title = title;
    }
    addComponent(component: FormComponent, label?: string):void {
        (this.data.content as FormComponent[]).push(component);
        if (label) this.labels.set(this.data.content!.length - 1, label);
    }
    getComponent(indexOrLabel: string | number):FormComponent | null {
        if (typeof indexOrLabel === "string") {
            for (const [index, label] of this.labels) {
                if (label === indexOrLabel) return (this.data.content as FormComponent[])[index];
            }
        } else {
            return (this.data.content as FormComponent[])[indexOrLabel];
        }
        return null;
    }
}

nethook.after(MinecraftPacketIds.ModalFormResponse).on((pk, ni) => {
    const sent = formMaps.get(pk.id);
    if (sent === undefined) return;
    if (sent.networkIdentifier !== ni) return; // other user is responsing
    formMaps.delete(pk.id);

    try {
        const response = JSON.parse(pk.response);
        sent.resolve(response);
    } catch (err) {
        sent.reject(err);
    }
});
