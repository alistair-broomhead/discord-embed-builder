document.addEventListener('DOMContentLoaded',function(){
    const setIn = (object, value, keyHead, ...keyTail) => {
        object = object === undefined? {} : object
        return (keyHead === undefined)?
            value : {
                ...object,
                [keyHead]: setIn(object[keyHead], value, ...keyTail)
            }
        },
          getIn = (obj, keyHead, ...keyTail) =>
                    (keyHead === undefined || obj === undefined)?
                        obj : getIn(obj[keyHead], ...keyTail),
          remove = function(obj, ...keyPath){
            const head = keyPath.slice(0, -1),
                  last = keyPath.slice(-1)[0]
                  parent = getIn(obj, head);
            delete parent[last];
          },
          pad = (n, digits) => {
            digits = digits === undefined? 2 : digits
            n = n + ''

            while (n.length < digits)
                n = '0' + n

            return n;
          };

    function Binding(el, type) {
        const k = el.keyPath;
        
        if (type === "color") return {
            import: () => {
                let value = getIn(internal, ...k);
                el.el.value = value === undefined?
                    null:
                    "#" + value.toString(16).padStart(6, '0');
            },
            export: () => {
                let value = Number("0x" + el.el.value.substring(1))
                internal = setIn(internal, value, ...k)
            }
        }
        if (type === "datetime-local") return {
            import: () => {
                let value = getIn(internal, ...k);

                if (value === undefined)
                    el.el.value = "";
                else {
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
                    el.el.value = dts;
                }
            },
            export: () => {
                let value = new Date(el.el.value);
                internal = setIn(internal, value.toISOString(), ...k)
            }
        }

        return {
            import: () => {
                let value = getIn(internal, ...k);
                el.el.value = value === undefined? "": value;
            },
            export: () => internal = setIn(internal, el.el.value, ...k)
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
        }
    };
    model.display.oninput = _ => model.reload();

    let fields = {
        _Field: (i, el) => {
            const parent = this;
            return {
                index: i,
                content: {
                    name: "",
                    value: "",
                    inline: false
                },
                pop: _ => {
                    internal.fields = [...internal.fields.slice(0, i), ...internal.fields.slice(i+1)];
                    parent.import();
                },
                el: (el !== undefined)? el : {
                    // TODO - create elements
                    name: {},
                    value: {},
                    inline: {}
                },
                import: _ => Object.keys(this.content).forEach(k =>
                    this.content[k] = this.el[k].value)
            };

        },
        elements: [],
        import: _ => {

        },
        export: _ => {
            internal.fields = this.elements.map(f => f.content);
            model.display.value = JSON.stringify(internal, null, 1);
        },
        add: _ => {
            let i = this.elements.length;
            this.elements.push(this._Field(i))
            internal.fields = this.elements.map(f => f.content);
        }
    };
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

}, false)