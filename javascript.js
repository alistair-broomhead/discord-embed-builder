function defaulted (value, defaultValue, fn){
    if (value === undefined)
        return defaultValue;
    if (fn === undefined)
        return value;
    return fn(value);
}

Object.defineProperties(Object.prototype, {
    setIn: {value: function (value, head, ...tail) {
        if (tail.length === 0) {
            this[head] = value;
            return this;
        }
        if (this[head] === undefined)
            this[head] = {};
        this[head].setIn(value, ...tail);
        return this;
    }},
    getIn: {value: function (head, ...tail) {
        if (head === undefined)
            return this;

        const child = this[head];

        if (child === undefined || tail.length === 0)
            return child;

        return child.getIn(...tail);
    }},
});

function pad (n, digits) {
    digits = defaulted(digits, 2);
    n = n + ''
    const needed = digits - n.length;
    return '0'.repeat(needed) + n;
}

function Binding(el, type) {
    const k = el.keyPath;

    if (type === "color") return {
        import: () =>
            el.el.value = defaulted(
                model.internal.getIn(...k),
                null,
                (v) => "#" + v.toString(16).padStart(6, '0')
            ),
        export: () => {
            let value = Number("0x" + el.el.value.substring(1))
            model.internal = model.internal.setIn(value, ...k)
        }
    }
    if (type === "datetime-local") return {
        import: () => el.el.value = defaulted(
            model.internal.getIn(...k), "", (value) => {
                let dts = ""
                value = new Date(value);
                [
                    value.getFullYear(),
                    "-", pad(value.getMonth() + 1),
                    "-", pad(value.getDate()),
                    "T", pad(value.getHours()),
                    ":", pad(value.getMinutes()),
                    ":", pad(value.getSeconds()),
                    ".", pad(value.getMilliseconds(), 3),
                ].forEach(v => dts = dts + v)
                return dts;
            }
        ),
        export: () => {
            let value = new Date(el.el.value);
            model.internal = model.internal.setIn(value.toISOString(), ...k)
        }
    }

    return {
        import: () => el.el.value = defaulted(model.internal.getIn(...k), ""),
        export: () => model.internal = model.internal.setIn(el.el.value, ...k),
    }
}

function Field (i) {
    const key = "model.fields["+i+"]";
    let parent = createElement({
        tag: "div",
        id: key,
        className: "section",
    });

    let field = {
        index: i,
        parent: parent,
        content: {
            name: "",
            value: "",
            inline: false
        },
        el: {
            name: createElement({
                tag: "input",
                className: "input",
            }),
            value: createElement({
                tag: "textarea",
                className: "input",
            }),
            inline: createElement({
                tag: "input",
                className: "input",
                type: "checkbox",
            }),
        },
        export: () => {
            field.content = {
                name: field.el.name.value,
                value: field.el.value.value,
                inline: field.el.inline.checked,
            };
            model.fields.export();
        },
        import: () => {
            field.el.name.value = field.content.name;
            field.el.value.value = field.content.value;
            field.el.inline.checked = field.content.inline;
        },
    };

    document.getElementById("fields").appendChild(parent);
    let heading = createElement({tag: "span"})
    parent.appendChild(heading)
    heading.appendChild(createElement({
        tag: "h3",
        innerText: "Field " + (i+1) + ":"
    }));
    heading.appendChild(createElement({
        tag: "button",
        innerText: "x",
        className: "clear-button",
        onclick: () => model.fields.remove(i),
    }));
    Object.entries(field.el).forEach(([k, v]) => {
        v.oninput = field.export
        let row = createElement({
            tag: "div",
            className: "attribute"
        });
        v.id = key + "." + k
        parent.appendChild(row)
        row.appendChild(createElement({
            tag: "label",
            forHTML: v.id,
            innerText: k[0].toUpperCase() + k.slice(1) + ":"
        }));
        row.appendChild(v);
    });

    return field;
}

function propertiesOf (element) {
    let properties = {};
    for (let attribute of element.attributes)
        properties[attribute.name] = attribute.value;
    return properties;
}

function InputElement(parent, {key, name, type}){
    parent.appendChild(createElement({
        tag: "label",
        innerText: name + ":",
        htmlFor: key
    }));

    let inputSpec = {
        id: key,
        tag: "input",
        className: "input",
        oninput: _ => model.set(this)
    };

    if (type === "textarea")
        inputSpec.tag = type;
    else if (type !== undefined)
        inputSpec.type = type;

    this.el = createElement(inputSpec);
    parent.appendChild(this.el);

    parent.appendChild(createElement({
        tag: "button",
        className: "clear-button",
        innerText: "x",
        onclick: () => model.remove(this),
    }))

    this.keyPath = key.split('.');
    this.binding = Binding(this, type);
}

function createElement({tag, ...attributes}) {
    let newElement = document.createElement(tag);

    Object.entries(attributes).forEach(([key, val]) => newElement[key] = val);

    return newElement;
}

let model = {
    internal: {},
    display: {
        get: () => {
            model.internal = JSON.parse(model.display.el.value);
            model.elements.forEach((el) => el.binding.import());
            model.fields.import();
        },
        set: () => {
            model.display.el.value = JSON.stringify(model.internal, null, 1);
            model.elements.forEach((el) => el.binding.import());
            model.fields.import();
        },
    },
    elements: [],
    set: el => {
        console.log(model.internal);
        el.binding.export();
        console.log(model.internal);
        model.display.set();
    },
    remove: (el) => {
        model.internal = model.internal.setIn(undefined, ...el.keyPath);
        el.binding.import();
        model.display.set();
    },
    fields: {
        elements: [],
        export: () => {
            model.internal.fields = model.fields.elements.map(f => f.content);
            if (model.internal.fields.length === 0)
                delete model.internal.fields;
            model.display.set();
        },
        import: () => {
            const want = defaulted(model.internal.fields, []).length;
            // Cut any excess
            while (model.fields.elements.length > want)
                model.fields.elements.pop().parent.remove();
            // Add any needed
            while (model.fields.elements.length < want)
                model.fields.elements.push(Field(model.fields.elements.length));

            for (let i = 0; i < want; i++){
                let field = model.fields.elements[i];
                field.content = model.internal.fields[i];
                field.import();
            }
        },
        add: () => {
            let i = model.fields.elements.length;
            model.fields.elements.push(Field(i))
            model.fields.export();
        },
        remove: i => {
            model.internal.fields = [
                ...model.internal.fields.slice(0, i),
                ...model.internal.fields.slice(i + 1)
            ]
            model.fields.import();
            model.display.set();
        }
    }
};

document.addEventListener('DOMContentLoaded',function(){
    model.display.el = document.getElementById("json-text");
    model.display.el.oninput = model.display.get;
    document.getElementById("add-field").onclick = model.fields.add;
    [...document.querySelectorAll("#form .attribute")].forEach(attribute => {
        let {key, name, type} = propertiesOf(attribute);

        if (name === undefined && key !== undefined)
            name = key[0].toUpperCase() + key.slice(1);

        let inputElement = new InputElement(attribute, {key, name, type})
        model.elements.push(inputElement);
    });

    model.internal = {
    "author": {
        "name": "me",
        "icon_url": "avatar",
        "url": "my blog"
    },
    "title": "title",
    "url": "title url",
    "thumbnail": {
        "url": "thumbnail url"
    },
    "description": "This is a description\n\nIt may be many lines",
    "image": {
        "url": "Splash Image url"
    },
    "color": 14290960,
    "fields": [
        {
            "name": "field 1",
            "value": "value",
            "inline": false
        },
        {
            "name": "field 2",
            "value": "value",
            "inline": true
        }
    ],
    "footer": {
        "icon_url": "Footer icon",
        "text": "Footer text"
    },
    "timestamp": "2022-04-19T18:56:01.040Z"
};
    model.display.set();

}, false)
