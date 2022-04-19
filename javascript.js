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
        const child = this[head];
        if (child === undefined || tail.length === 0)
            return child;
        return child.getIn(...tail);
    }},
    removeIn: {value: function (...path) {
        const last = path[path.length - 1],
              parent = this.getIn(...path.slice(0, -1));
        delete parent[last];
        return this;
    }}
});

function pad (n, digits) {
    digits = defaulted(digits, 2);
    n = n + ''
    const needed = digits - n.length;
    return '0'.repeat(needed) + n;
}


document.addEventListener('DOMContentLoaded',function(){

    function Binding(el, type) {
        const k = el.keyPath;

        if (type === "color") return {
            import: () =>
                el.el.value = defaulted(
                    internal.getIn(...k),
                    null,
                    (v) => "#" + v.toString(16).padStart(6, '0')
                ),
            export: () => {
                let value = Number("0x" + el.el.value.substring(1))
                internal = internal.setIn(value, ...k)
            }
        }
        if (type === "datetime-local") return {
            import: () => el.el.value = defaulted(
                internal.getIn(...k), "", (value) => {
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
                internal = internal.setIn(value.toISOString(), ...k)
            }
        }

        return {
            import: () => el.el.value = defaulted(internal.getIn(...k), ""),
            export: () => internal = internal.setIn(el.el.value, ...k)
        }
    }

    let internal = {};

    let model = {
        display: document.getElementById("json-text"),
        elements: [],
        set: el => {
            el.binding.export();
            console.log(internal);
            model.display.value = JSON.stringify(internal, null, 1);
        },
        remove: el => remove(internal, ...k),
        reload: () =>  {
            internal = JSON.parse(model.display.value);
            model.elements.forEach((el) => el.binding.import());
            fields.import();
        }
    };
    model.display.oninput = _ => model.reload();

    function Field (i) {
        const key = "fields["+i+"]";
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
                fields.export();
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
            onclick: () => fields.remove(i),
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

    let fields = {
        elements: [],
        export: () => {
            internal.fields = fields.elements.map(f => f.content);
            if (internal.fields.length === 0)
                delete internal.fields;
            model.display.value = JSON.stringify(internal, null, 1);
        },
        import: () => {
            const want = defaulted(internal.fields, []).length;
            // Cut any excess
            while (fields.elements.length > want)
                fields.elements.pop().parent.remove();
            // Add any needed
            while (fields.elements.length < want)
                fields.elements.push(Field(fields.elements.length));

            for (let i = 0; i < want; i++){
                let field = fields.elements[i];
                field.content = internal.fields[i];
                field.import();
            }
        },
        add: () => {
            let i = fields.elements.length;
            fields.elements.push(Field(i))
            fields.export();
        },
        remove: i => {
            internal.fields = [
                ...internal.fields.slice(0, i),
                ...internal.fields.slice(i + 1)
            ]
            fields.import();
        }
    };
    document.getElementById("add-field").onclick = fields.add
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

        // TODO - create clear button

        this.keyPath = key.split('.');
        this.binding = Binding(this, type);
    }

    function createElement({tag, ...attributes}) {
        let newElement = document.createElement(tag);

        Object.entries(attributes).forEach(([key, val]) => newElement[key] = val);

        return newElement;
    }

    [...document.querySelectorAll("#form .attribute")].forEach(attribute => {
        let {key, name, type} = propertiesOf(attribute);

        if (name === undefined && key !== undefined)
            name = key[0].toUpperCase() + key.slice(1);

        let inputElement = new InputElement(attribute, {key, name, type})
        model.elements.push(inputElement);
    });

    model.display.value = JSON.stringify({
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
 "timestamp": "2022-04-19T18:56:00.000Z"
}, null, 1);
    model.reload();

}, false)
