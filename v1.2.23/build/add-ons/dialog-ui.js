(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports['list-dragon-addendum'] = [
'div.dragon-list, li.dragon-pop {',
'	font-family: Roboto, sans-serif;',
'	text-transform: capitalize; }',
'div.dragon-list {',
'	position: absolute;',
'	top: 4%;',
'	left: 4%;',
'	height: 92%;',
'	width: 20%; }',
'div.dragon-list:nth-child(2) { left: 28%; }',
'div.dragon-list:nth-child(3) { left: 52%; }',
'div.dragon-list:nth-child(4) { left: 76%; }',
'div.dragon-list > div, div.dragon-list > ul > li, li.dragon-pop { line-height: 46px; }',
'div.dragon-list > ul { top: 46px; }',
'div.dragon-list > ul > li:not(:last-child)::before, li.dragon-pop::before {',
'	content: \'\\2b24\';',
'	color: #b6b6b6;',
'	font-size: 30px;',
'	margin: 8px 14px 8px 8px; }',
'li.dragon-pop { opacity:.8; }'
].join('\n');

},{}],2:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var ListDragon = require('list-dragon');
var injectCSS = require('inject-stylesheet-template').bind(require('../css'));

var Dialog = require('./Dialog');

/**
 * @constructor
 * @extends Dialog
 */
var ColumnPicker = Dialog.extend('ColumnPicker', {
    /**
     * @param {Hypergrid} grid
     * @param {object} [options] - May include `Dialog` options.
     */
    initialize: function(grid, options) {
        var behavior = grid.behavior;

        this.grid = grid;

        if (behavior.isColumnReorderable()) {
            // parse & add the drag-and-drop stylesheet addendum
            var stylesheetAddendum = injectCSS('list-dragon-addendum');

            // grab the group lists from the behavior
            if (behavior.setGroups) {
                this.selectedGroups = {
                    title: 'Groups',
                    models: behavior.getGroups()
                };

                this.availableGroups = {
                    title: 'Available Groups',
                    models: behavior.getAvailableGroups()
                };

                var groupPicker = new ListDragon([
                    this.selectedGroups,
                    this.availableGroups
                ]);

                // add the drag-and-drop sets to the dialog
                this.append(groupPicker.modelLists[0].container);
                this.append(groupPicker.modelLists[1].container);
            }

            // grab the column lists from the behavior
            this.inactiveColumns = {
                title: 'Inactive Columns',
                models: behavior.getHiddenColumns().sort(compareByName)
            };

            this.activeColumns = {
                title: 'Active Columns',
                models: grid.getActiveColumns()
            };

            this.sortOnHiddenColumns = this.wasSortOnHiddenColumns = true;

            var columnPicker = new ListDragon([
                this.inactiveColumns,
                this.activeColumns
            ], {
                // add the list-dragon-base stylesheet right before the addendum
                cssStylesheetReferenceElement: stylesheetAddendum,
                // these models have a header property as their labels
                label: '{header}'
            });

            // add the drag-and-drop sets to the dialog
            this.append(columnPicker.modelLists[0].container);
            this.append(columnPicker.modelLists[1].container);

            //Listen to the visible column changes
            columnPicker.modelLists[1].element.addEventListener('listchanged', function(e){
                grid.fireSyntheticOnColumnsChangedEvent();
            });

            this.sortOnHiddenColumns = this.grid.properties.sortOnHiddenColumns;
        } else {
            var div = document.createElement('div');
            div.style.textAlign = 'center';
            div.style.marginTop = '2em';
            div.innerHTML = 'The selection of visible columns in the grid may not be changed.';
            this.append(div);
        }

        // Add checkbox to control panel for sorting on hidden fields
        var label = document.createElement('label');
        label.innerHTML = '<input type="checkbox"> Allow sorting on hidden columns';
        label.style.fontWeight = 'normal';
        label.style.marginRight = '2em';

        var checkbox = label.querySelector('input');
        checkbox.checked = this.sortOnHiddenColumns;
        checkbox.addEventListener('click', function(e){
            self.sortOnHiddenColumns = checkbox.checked;
            e.stopPropagation();
        });

        var panel = this.el.querySelector('.hypergrid-dialog-control-panel');
        panel.insertBefore(label, panel.firstChild);

        // add the dialog to the DOM
        this.open(options.container);
    },

    onClosed: function() {
        var behavior = this.grid.behavior,
            columns = behavior.getActiveColumns();

        if (this.activeColumns) {
            var tree = columns[0];

            // TODO: breaking encapsulation; should be using setters and getters on the behavior
            columns.length = 0;
            if (tree && tree.label === 'Tree') {
                columns.push(tree);
            }
            this.activeColumns.models.forEach(function(column) {
                columns.push(column);
            });

            if (this.sortOnHiddenColumns !== this.wasSortOnHiddenColumns) {
                behavior.sortChanged(this.inactiveColumns.models);
            }

            behavior.changed();
        }

        if (this.selectedGroups){
            var groupBys = this.selectedGroups.models.map(function(e) {
                return e.id;
            });
            behavior.setGroups(groupBys);
        }

        this.grid.takeFocus();
        this.grid.allowEvents(true);
    }
});

function compareByName(a, b) {
    a = a.header.toString().toUpperCase();
    b = b.header.toString().toUpperCase();
    return a < b ? -1 : a > b ? +1 : 0;
}


module.exports = ColumnPicker;

},{"../css":1,"./Dialog":3,"inject-stylesheet-template":14,"list-dragon":15}],3:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var automat = require('automat');
var markup = require('../html');

var Base = window.fin.Hypergrid.Base; // try require('fin-hypergrid/src/Base') when externalized

/**
 * Creates and services a DOM element used as a cntainer for a dialog. The standard `markup.dialog` is simply a div with a _control panel_ containing a close box and a settings gear icon.
 *
 * You can supply an alternative dialog template. The interface is:
 * * Class name `hypergrid-dialog`.
 * * At least one child element. Content will be inserted before this first child.
 * * Typically contains a close-box element with class name `hypergrid-dialog-close` and possibly other controls with class name `hypergrid-dialog-xxxx` (where _xxxx_ is a unique name for your control).
 *
 * @constructor
 */
var Dialog = Base.extend('Dialog', {

    /**
     * Creates a basic dialog box in `this.el`.
     * @param {Hypergrid} grid
     * @param {object} [options]
     * @param {string|function} [options.dialogTemplate] - An alternate dialog template. The last child element must be the "control panel."
     * @param {boolean} [options.settings=true] - Control box has settings icon. (Settings icon must be included in template. This option removes it. That is, if explicitly `false` _and_ there is a settings control, remove it.)
     * @param {string|boolean} [options.backgroundImage=images.dialog.src] - A URI for a background image. If explicitly `false`, background image is suppressed.
     * @param {function} [terminate]
     */
    initialize: function(grid, options) {
        options = options || {};

        this.grid = grid;

        // create the backdrop; it is absolute-positioned and stretched
        this.el = automat.firstChild(options.dialogTemplate || markup.dialog, options.dialogReplacements);

        this.originalFirstChild = this.el.firstElementChild;

        if (options.settings === false) {
            var settings = this.el.querySelector('.hypergrid-dialog-settings');
            if (settings) {
                settings.remove();
            }
        }

        // set alternative background image
        if (options.backgroundImage === false) {
            this.el.style.backgroundImage = null;
        } else if (options.backgroundImage) {
            this.el.style.backgroundImage = 'url(\'' + options.backgroundImage + '\')';
        }

        // listen for clicks
        this.el.addEventListener('click', onClick.bind(this));

        if (options.terminate) {
            this.terminate = options.terminate;
        }
    },

    /**
     * @summary Adds DOM `Node`s to dialog.
     * @desc Input can be nodes or a template from which to create nodes. The nodes are inserted into the dialog's DOM (`this.el`), right before the "control panel."
     * @param {string|function|Node|Node[]} nodes - See `automat`.
     * @param {...*} [replacements] - See `automat`.
     */
    append: function(nodes, replacements/*...*/) {
        if (typeof nodes === 'string' || typeof nodes === 'function') {
            var args = Array.prototype.slice.call(arguments);
            args.splice(1, 0, this.el, this.originalFirstChild);
            automat.append.apply(null, args);

        } else if ('length' in nodes) {
            for (var i = 0; i < nodes.length; ++i) {
                this.el.insertBefore(nodes[i], this.originalFirstChild);
            }

        } else {
            this.el.insertBefore(nodes, this.originalFirstChild);
        }
    },

    /**
     * Insert dialog into DOM.
     *
     * @param {HTMLElement} [container] - If undefined, dialog is appended to body.
     *
     * If defined, dialog is appended to container. When container is not body, it will be:
     * 0. made visible before append (it should initially be hidden)
     * 0. made hidden after remove
     */
    open: function(container) {
        var error;

        if (!(this.opened || this.opening || this.closed || this.closing)) {
            error = this.onOpen();

            if (!error) {
                var el = this.el;

                this.opening = true;

                container = container || document.querySelector('body');

                if (container.tagName !== 'BODY') {
                    container.style.visibility = 'visible';
                }

                // insert the new dialog markup into the DOM
                container.appendChild(el);

                // schedule it for a show transition
                setTimeout(function() { el.classList.add('hypergrid-dialog-visible'); }, 50);

                // at end of show transition, hide all the hypergrids behind it to prevent any key/mouse events from getting to them
                // todo: pause all hypergrids so they don't spin uselessly
                el.addEventListener('transitionend', this.hideAppBound = hideApp.bind(this));
            }
        }

        return error;
    },

    /**
     * Remove dialog from DOM.
     */
    close: function() {
        var error;

        if (this.opened && !(this.closed || this.closing)) {
            error = this.onClose();

            if (!error) {
                this.closing = true;

                // unhide all the hypergrids behind the dialog
                this.appVisible('visible');

                // start a hide transition of dialog revealing grids behind it
                this.el.classList.remove('hypergrid-dialog-visible');

                // at end of hide transition, remove dialog from the DOM
                this.el.addEventListener('transitionend', this.removeDialogBound = removeDialog.bind(this));
            }
        }

        return error;
    },

    appSelector: 'canvas.hypergrid',
    appVisible: function(visibility) {
        Array.prototype.forEach.call(document.querySelectorAll(this.appSelector), function(el) {
            el.style.visibility = visibility;
        });
    },

    onOpen: nullPattern,
    onOpened: nullPattern,
    onClose: nullPattern,
    onClosed: nullPattern,
    terminate: nullPattern
});

function nullPattern() {}

function removeDialog(evt) {
    if (evt.target === this.el && evt.propertyName === 'opacity') {
        this.el.removeEventListener('transitionend', this.removeDialogBound);

        if (this.el.parentElement.tagName !== 'BODY') {
            this.el.parentElement.style.visibility = 'hidden';
        }
        this.el.remove();
        delete this.el;

        this.onClosed();
        this.terminate();
        this.closing = false;
        this.closed = true;
    }
}

function hideApp(evt) {
    if (evt.target === this.el && evt.propertyName === 'opacity') {
        this.el.removeEventListener('transitionend', this.hideAppBound);

        this.appVisible('hidden');
        this.onOpened();
        this.opening = false;
        this.opened = true;
    }
}

function onClick(evt) {
    if (this) {
        if (evt.target.classList.contains('hypergrid-dialog-close')) {
            evt.preventDefault(); // ignore href
            this.close();

        } else if (evt.target.classList.contains('hypergrid-dialog-settings')) {
            evt.preventDefault(); // ignore href
            if (this.settings) { this.settings(); }

        } else if (this.onClick && !this.onClick.call(this, evt) && evt.target.tagName === 'A') {
            evt.preventDefault(); // ignore href of handled event
        }
    }

    evt.stopPropagation(); // the click stops here, handled or not
}

module.exports = Dialog;

},{"../html":8,"automat":12}],4:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var Tabz = require('tabz');
var popMenu = require('pop-menu');
var automat = require('automat');

var Dialog = require('./Dialog');
var markup = require('../html');
var copyInput = require('./copy-input');

var tabProperties = {
    tableQB: {
        isTableFilter: true
    },
    tableSQL: {
        isTableFilter: true,
        language: 'SQL'
    },
    columnsQB: {
        isColumnFilter: true
    },
    columnsSQL: {
        isColumnFilter: true,
        language: 'SQL'
    },
    columnsCQL: {
        isColumnFilter: true,
        language: 'CQL'
    }
};

/**
 * @constructor
 * @extends Dialog
 */
var ManageFilters = Dialog.extend('ManageFilters', {

    /**
     * @param {Hypergrid} grid
     * @param {object} [options] - May include `Dialog` options.
     * @param {HTMLElement} [options.container=document.body]
     */
    initialize: function(grid, options) {
        this.filter = grid.filter;

        this.append(markup.filterTrees);

        // initialize the folder tabs
        var tabz = this.tabz = new Tabz({
            root: this.el,
            onEnable: renderFolder.bind(this),
            onDisable: saveFolders.bind(this, null) // null options
        });

        // wire-up the New Column drop-down
        var newColumnDropDown = this.el.querySelector('#add-column-filter-subexpression');
        newColumnDropDown.onmousedown = onNewColumnMouseDown.bind(this);
        newColumnDropDown.onchange = onNewColumnChange.bind(this);

        // put the two subtrees in the two panels
        tabz.folder('#tableQB').appendChild(this.filter.tableFilter.el);
        tabz.folder('#columnsQB').appendChild(this.filter.columnFilters.el);

        // copy the SQL more-info block from the table to the columns tab
        var columnSqlEl = tabz.folder('#columnsSQL');
        var moreSqlInfo = tabz.folder('#tableSQL').firstElementChild.cloneNode(true);
        columnSqlEl.insertBefore(moreSqlInfo, columnSqlEl.firstChild);

        // add it to the DOM
        this.open(options.container);

        // following needed for unclear reasons to get drop-down to display correctly
        newColumnDropDown.selectedIndex = 0;
    },

    onClose: function() {
        return saveFolders.call(this);
    },

    onClosed: function() {
        var behavior = this.grid.behavior;
        this.grid.takeFocus();
        this.grid.allowEvents(true);
        behavior.reindex();
        behavior.changed();
    },

    /**
     * Custom click handlers; called by curtain.onclick in context
     * @param evt
     * @returns {boolean}
     */
    onClick: function(evt) { // to be called with filter object as syntax
        var ctrl = evt.target;

        if (ctrl.classList.contains('more-info')) {
            // find all more-info links and their adjacent blocks (blocks always follow links)
            var els = this.el.querySelectorAll('.more-info');

            // hide all more-info blocks except the one following this link (unless it's already visible in which case hide it too).
            for (var i = 0; i < els.length; ++i) {
                var el = els[i];
                if (el.tagName === 'A') {
                    var found = el === ctrl;
                    el.classList[found ? 'toggle' : 'remove']('hide-info');
                    el = els[i + 1];
                    el.style.display = found && el.style.display !== 'block' ? 'block' : 'none';
                }
            }

        } else if (ctrl.classList.contains('filter-copy')) {
            var isCopyAll = ctrl.childNodes.length; // contains "All"
            if (isCopyAll) {
                ctrl = this.tabz.folder(ctrl).querySelector(copyInput.selectorTextControls);
                copyInput(ctrl, this.filter.columnFilters.getState({ syntax: 'SQL' }));
            } else {
                copyInput(ctrl.parentElement.querySelector(copyInput.selectorTextControls));
            }

        } else {
            return true; // means unhandled
        }
    }
});

/**
 * @param options
 * @param tab
 * @param folder
 * @param [panel] Panel to save (from tab click). If omitted, save both panels (from onclose).
 * @returns {boolean|undefined|string}
 */
function saveFolders(options, tab, folder, panel) {
    return (
        (!panel || panel.id === 'tableFilterPanel') && saveFolder.call(this, this.filter.tableFilter, options) ||
        (!panel || panel.id === 'columnFiltersPanel') && saveFolder.call(this, this.filter.columnFilters, options)
    );
}

/**
 * @this Filter
 * @param {DefaultFilter} subtree
 * @param {object} [options={alert:true,focus:true}] - Side effects as per `FilterTree.prototype.invalid`'s `options`' parameter.
 * @returns {undefined|string} - Validation error text; falsy means valid (no error).
 */
function saveFolder(subtree, options) { // to be called with filter object as syntax
    var isColumnFilters = subtree === this.filter.columnFilters,
        tabQueryBuilder = this.tabz.tab(isColumnFilters ? '#columnsQB' : '#tableQB'),
        tab = this.tabz.enabledTab(tabQueryBuilder),
        folder = this.tabz.folder(tab),
        isQueryBuilder = tab === tabQueryBuilder,
        defaultedOptions = options || {
            alert: true,
            focus: true
        },
        enhancedOptions = {
            alert: defaultedOptions.alert,
            focus: defaultedOptions.focus && isQueryBuilder
        },
        error, ctrl;

    if (isColumnFilters || isQueryBuilder) {
        error = subtree.invalid(enhancedOptions);
    } else { // table filter SQL tab
        ctrl = folder.querySelector('textarea');
        error = this.filter.setTableFilterState(ctrl.value, options);
    }

    if (error && !isQueryBuilder) {
        // If there was a validation error, move the focus from the query builder control to the text box control.
        if (isColumnFilters) {
            // We're in SQL or CQL tab so find text box that goes with this subexpression and focus on it instead of QB control.
            var errantColumnName = error.node.el.parentElement.querySelector('input').value;
            ctrl = folder.querySelector('[name="' + errantColumnName + '"]');
        }
    }

    if (ctrl) {
        decorateFilterInput(ctrl, error);
    }

    return error;
}

function decorateFilterInput(ctrl, error) {
    ctrl.classList.toggle('filter-tree-error', !!error);

    ctrl.focus();

    // find the nearby warning element
    var warningEl;
    do {
        ctrl = ctrl.parentElement;
        warningEl = ctrl.querySelector('.filter-tree-warn');
    } while (!warningEl);

    // show or hide the error
    warningEl.innerHTML = error.message || error || '';
}

function onNewColumnMouseDown(evt) { // to be called with filter object as syntax
    if (saveFolder.call(this, this.filter.columnFilters)) {
        evt.preventDefault(); // do not drop down
    } else {
        // (re)build the drop-down contents, with same prompt, but excluding columns with active filter subexpressions
        var ctrl = evt.target,
            prompt = ctrl.options[0].text.replace('…', ''), // use original but w/o ellipsis as .build() appends one
            blacklist = this.filter.columnFilters.children.map(function(columnFilter) {
                return columnFilter.children.length && columnFilter.children[0].column;
            }),
            options = {
                prompt: prompt,
                blacklist: blacklist
            };

        popMenu.build(ctrl, this.filter.root.schema, options);
    }
}

function onNewColumnChange(evt) {
    var ctrl = evt.target,
        tabColumnQB = this.tabz.folder('#tableQB'),
        tab = this.tabz.enabledTab(tabColumnQB.parentElement),
        isQueryBuilder = tab === tabColumnQB,
        tabProps = tabProperties[tab.id];

    this.filter.columnFilters.add({
        state: {
            type: 'columnFilter',
            children: [ { column: ctrl.value } ]
        },
        focus: isQueryBuilder
    });

    if (tabProps.isColumnFilter && tabProps.lanugage) {
        renderFolder.call(this, tab);
    }

    // remove all but the prompt option (first child)
    ctrl.selectedIndex = 0;
    while (ctrl.lastChild !== ctrl.firstChild) {
        ctrl.removeChild(ctrl.lastChild);
    }
}

function renderFolder(tab) { // to be called with filter object as syntax
    var tabProps = tabProperties[tab.id],
        queryLanguage = tabProps.language;

    if (queryLanguage) {
        var globalFilter = this.filter,
            folder = this.tabz.folder(tab);

        if (tabProps.isTableFilter) {

            folder.querySelector('textarea').value = globalFilter.tableFilter.getState({ syntax: 'SQL' });

        } else { // column filter

            var columnFilters = globalFilter.columnFilters.children,
                el = folder.lastElementChild,
                msgEl = el.querySelector('span'),
                listEl = el.querySelector('ol'),
                copyAllLink = el.querySelector('a:first-of-type');

            msgEl.innerHTML = activeFiltersMessage(columnFilters.length);
            listEl.innerHTML = '';

            // for each column filter subtree, append an <li>...</li> element containing:
            // column title, "(copy)" link, and editable text input box containing the subexpression
            columnFilters.forEach(function(filter) {
                var conditional = filter.children[0],
                    item = conditional.schema[0],
                    name = conditional.column,
                    alias = item.alias || name,
                    expression = filter.getState({ syntax: queryLanguage }),
                    isNull = expression === '(NULL IS NULL)' || expression === '',
                    content = isNull ? '' : expression,
                    className = isNull ? 'filter-tree-error' : '',
                    li = automat.firstChild(markup[queryLanguage], alias, name, content, className);

                listEl.appendChild(li);
            });

            folder.onkeyup = setColumnFilterState.bind(this, queryLanguage);

            if (copyAllLink) {
                // if there's a "(copy all)" link, hide it if only 0 or 1 subexpressions
                copyAllLink.style.display = columnFilters.length > 1 ? 'block' : 'none';
            }
        }

    }
}

//var RETURN_KEY = 0x0d, ESCAPE_KEY = 0x1b;
/**
 * Called from key-up events from `#columnSQL` and `#columnCQL` tabs.
 * @this Filter
 * @param {string} queryLanguage
 * @param {KeyboardEvent} evt
 */
function setColumnFilterState(queryLanguage, evt) {
    var ctrl = evt.target;

    // Only handle if key was pressed inside a text box.
    if (ctrl.classList.contains('filter-text-box')) {
        //switch (evt.keyCode) {
        //    case ESCAPE_KEY:
        //        ctrl.value = oldArg;
        //    case RETURN_KEY: // eslint-disable-line no-fallthrough
        //        ctrl.blur();
        //        break;
        //    default:
        var error,
            options = { syntax: queryLanguage, alert: true };

        try {
            error = this.filter.setColumnFilterState(ctrl.name, ctrl.value, options);
        } catch (err) {
            error = err;
        }

        decorateFilterInput(ctrl, error);
        //}
    }
}

function activeFiltersMessage(n) {
    var result;

    switch (n) {
        case 0:
            result = 'There are no active column filters.';
            break;
        case 1:
            result = 'There is 1 active column filter:';
            break;
        default:
            result = 'There are ' + n + ' active column filters:';
    }

    return result;
}


module.exports = ManageFilters;

},{"../html":8,"./Dialog":3,"./copy-input":5,"automat":12,"pop-menu":18,"tabz":19}],5:[function(require,module,exports){
/* eslint-env browser */

'use strict';

/**
 *
 * @param {HTMLElement} [containingEl=document]
 * @param {string} [prefix='']
 * @param {string} [separator='']
 * @param {string} [suffix='']
 * @param {function} [transformer=multiLineTrim] - Function to transform each input control's text value.
 */
function copyAll(containingEl, prefix, separator, suffix, transformer) {
    var texts = [], lastTextEl, text;

    Array.prototype.forEach.call((containingEl || document).querySelectorAll(copyAll.selector), function(textEl) {
        text = (transformer || multiLineTrim)(textEl.value);
        if (text) { texts.push(text); }
        lastTextEl = textEl;
    });

    if (lastTextEl) {
        copy(lastTextEl, (prefix || '') + texts.join(separator || '') + (suffix || ''));
    }
}

/**
 * 1. Trim the text in the given input element
 * 2. select it
 * 3. copy it to the clipboard
 * 4. deselect it
 * 5. return it
 * @param {HTMLElement|HTMLTextAreaElement} el
 * @param {string} [text=el.value] - Text to copy.
 * @returns {undefined|string} Trimmed text in element or undefined if unable to copy.
 */
function copy(el, text) {
    var result, textWas;

    if (text) {
        textWas = el.value;
        el.value = text;
    } else {
        text = el.value;
    }

    el.value = multiLineTrim(text);

    try {
        el.select();
        result = document.execCommand('copy');
    } catch (err) {
        result = false;
    } finally {
        if (textWas !== undefined) {
            el.value = textWas;
        }
        el.blur();
    }
    return result;
}

function multiLineTrim(s) {
    return s.replace(/^\s*(.*?)\s*$/, '$1');
}

copy.all = copyAll;
copy.multiLineTrim = multiLineTrim;
copy.selectorTextControls = 'input:not([type]), input[type=text], textarea';

module.exports = copy;

},{}],6:[function(require,module,exports){
'use strict';

module.exports.ColumnPicker = require('./ColumnPicker');
module.exports.ManageFilters = require('./ManageFilters');

},{"./ColumnPicker":2,"./ManageFilters":4}],7:[function(require,module,exports){
'use strict';

var overrider = require('overrider');

/**
 * @param {Hypergrid} grid
 * @param {object} [targets] - Hash of mixin targets. These are typically prototype objects. If not given or any targets are missing, defaults to current grid's various prototypes.
 * @constructor
 */
function DialogUI(grid, targets) {
    this.grid = grid;
    targets = targets || {};

    var Hypergrid = this.grid.constructor;
    Hypergrid.defaults.mixIn(require('./mix-ins/defaults'));

    mixInTo('Hypergrid', grid, require('./mix-ins/grid'));
    mixInTo('Behavior', grid.behavior, require('./mix-ins/behavior'));

    grid.addInternalEventListener('fin-keyup', function(e) {
        var charPressed = e.detail.char;
        grid.properties.editorActivationKeys.find(function(activationKey) {
            var isActivationKey = charPressed === activationKey.toUpperCase();
            if (isActivationKey) {
                grid.toggleDialog('ColumnPicker');
            }
            return isActivationKey;
        });
    });

    function mixInTo(target, instance, mixin) {
        var object = targets[target];
        var prototype = object && object.prototype || Object.getPrototypeOf(instance);

        overrider(prototype, mixin);
    }
}

DialogUI.prototype.$$CLASS_NAME = 'DialogUI';

window.fin.Hypergrid.DialogUI = DialogUI;

},{"./mix-ins/behavior":9,"./mix-ins/defaults":10,"./mix-ins/grid":11,"overrider":17}],8:[function(require,module,exports){
'use strict';

exports.CQL = [
'<li>',
'	<label title="${1}">',
'		<a type="button" class="filter-copy"></a>',
'		<div class="filter-tree-remove-button" title="delete conditional"></div>',
'		<strong>%{0}:</strong>',
'		<input name="${1}" class="filter-text-box ${3}" value="%{2}">',
'	</label>',
'	<div class="filter-tree-warn"></div>',
'</li>'
].join('\n');

exports.SQL = [
'<li>',
'	<label title="${1}">',
'		<a type="button" class="filter-copy"></a>',
'		<div class="filter-tree-remove-button" title="delete conditional"></div>',
'		<strong>%{0}:</strong>',
'		<textarea name="${1}" rows="1" class="filter-text-box ${3}">%{2}</textarea>',
'	</label>',
'	<div class="filter-tree-warn"></div>',
'</li>'
].join('\n');

exports.dialog = [
'<div id="hypergrid-dialog">',
'',
'	<style>',
'		#hypergrid-dialog {',
'			position: absolute;',
'			top: 0;',
'			left: 0;',
'			bottom: 0;',
'			right: 0;',
'			background-color: white;',
'			background-image: url(data:png;base64,iVBORw0KGgoAAAANSUhEUgAAAH4AAAAUCAMAAAB8knmGAAAAXVBMVEXn4tfm4dfn4tjn49no5Nrp5dzp5Nvm4dbi3NDg2s3o5Nvl4NTh287k39Pp5dvh3M/j3dHk39Tl4NXg287k3tPi3dHh3NDm4tfj3tLh28/o49ro49ng2s7l4dbl4Nb6VbEyAAAC1ElEQVR4AXVV0YKDKAwE4AAVK6SwC9bt/3/mnYJ2tF7ewMEJyWRgjHMuhFT/nEMb261hxbrqh23hRomYhxLrYfXATTm6DTv060q0vxh9+b+SYj3Muj3c5IORAFMBEtD0rKgoAHIJLWLlfpIG8qAAIk3wk9tJKz2E84GrHUvbVhLbyvw0iA2/6ota/Qbbvv+YbUekbUV6R/Dg3YWN+ZyzT/a8X6KpBLpW3cta2FCOLFMkLuZe97PgFJM7joaG9bUHlVyZWM63tGllZp+yzIwipGFJQwJ5rqgX2e7/w9KrwuYMAtBkgTbS73z0r9JD9IJyy2GJEjSQD9kJwiIeTSNxyC9Dz2VcGiKT6IHplr7VynbA+UpVA+bxQYi/kNPknJtSDn9CfebBNPSrZdK0r+6ImE8p5RzDm4szgFtIQNqme3ZkcBsP1rRvJZBbfr6c4O8Qc04pgfJrY5rs4dJ5hhZ0z9z6+x0vys8Oyj5nKEMTP8oLBw+7OAh9TkCdJ8/5Nno4dt6d506dybUYbhTDmFjtxwxjTvjVDhITiJVNoe5LyoGIQk4Ftd+QEcnlYPF+KY+DWc1WgPSqJeXjXxPpT9uXoBqGx6m7jylyvRvm8hGApuNAyWis98rXYvevZVSguzgfw8kGf3aR4gd2DNUcQX1qXHavvLFrpv6L/nt/d+9RXV8OFDCFEAhHBt+qSr6/FN+37JVS7BC9zwOXj6/JW04JLB7m984v/HIiX77m7iH5kL1198ov8OI0ziX01b32Fo9c3VHzce9xdcs+LC0TeHPKRfmulOLcZfTyW2ICz6Dr5Fl4F41o1q1nYeAts6buhieSy3e+kqzM7PP885AtfB0FJOCoUZnUQSyllAU3kmk4ckAuRqC2OXAh1b3ylaBj9Ka3PidQQxJcBEtGrWRncv2ejrEjVCnSX9tYOuBk07YI4J6MYppcBU0pEgOvDtv+xCCTrtwL5l87wVO3O/g5GQAAAABJRU5ErkJggg==);',
'			font: 10pt sans-serif;',
'			opacity: 0;',
'			transition: opacity 1s;',
'			box-shadow: rgba(0, 0, 0, 0.298039) 0px 19px 38px, rgba(0, 0, 0, 0.219608) 0px 15px 12px;',
'		}',
'		#hypergrid-dialog.hypergrid-dialog-visible {',
'			opacity: 1;',
'			transition: opacity 1s;',
'		}',
'',
'		#hypergrid-dialog .hypergrid-dialog-control-panel {',
'			position: absolute;',
'			top: 0px;',
'			right: 12px;',
'		}',
'		#hypergrid-dialog .hypergrid-dialog-control-panel a {',
'			color: #999;',
'			font-size: 33px;',
'			transition: text-shadow .35s, color .35s;',
'			text-decoration: none;',
'		}',
'		#hypergrid-dialog .hypergrid-dialog-close:after {',
'			content: \'\\D7\';',
'		}',
'		#hypergrid-dialog .hypergrid-dialog-settings:after {',
'			font-family: Apple Symbols;',
'			content: \'\\2699\';',
'		}',
'		#hypergrid-dialog .hypergrid-dialog-control-panel a:hover {',
'			color: black;',
'			text-shadow: 0 0 6px #337ab7;',
'			transition: text-shadow .35s, color .35s;',
'		}',
'		#hypergrid-dialog .hypergrid-dialog-control-panel a:active {',
'			color: #d00;',
'			transition: color 0s;',
'		}',
'	</style>',
'',
'	<span class="hypergrid-dialog-control-panel">',
'		<a class="hypergrid-dialog-settings" title="(There are no settings for Manage Filters at this time.)"></a>',
'		<a class="hypergrid-dialog-close"></a>',
'	</span>',
'',
'</div>'
].join('\n');

exports.filterTrees = [
'<style>',
'	#hypergrid-dialog > div {',
'		position: absolute;',
'		top: 0;',
'		left: 0;',
'		bottom: 0;',
'		right: 0;',
'	}',
'	#hypergrid-dialog > div:first-of-type {',
'		padding: 1em 1em 1em 0.5em;',
'		margin-left: 50%;',
'	}',
'	#hypergrid-dialog > div:last-of-type {',
'		padding: 1em 0.5em 1em 1em;',
'		margin-right: 50%;',
'	}',
'	#hypergrid-dialog > div > p:first-child {',
'		margin-top: 0;',
'	}',
'	#hypergrid-dialog > div > p > span:first-child {',
'		font-size: larger;',
'		letter-spacing: 2px;',
'		font-weight: bold;',
'		color: #666;',
'		margin-right: 1em;',
'	}',
'	#hypergrid-dialog input, #hypergrid-dialog textarea {',
'		outline: 0;',
'		line-height: initial;',
'	}',
'',
'	.tabz { z-index: 0 }',
'	.tabz > p:first-child, .tabz > section > p:first-child, .tabz > section > div > p:first-child { margin-top: 0 }',
'',
'	#hypergrid-dialog a.more-info { font-size: smaller; }',
'	#hypergrid-dialog a.more-info::after { content: \'(more info)\'; }',
'	#hypergrid-dialog a.more-info.hide-info { color: red; }',
'	#hypergrid-dialog a.more-info.hide-info::after { content: \'(hide info)\'; }',
'	#hypergrid-dialog div.more-info {',
'		border: 1px tan solid;',
'		border-radius: 8px;',
'		padding: 0 8px .2em;',
'		display: none;',
'		background-color: ivory;',
'		box-shadow: 3px 3px 5px #707070;',
'		margin-bottom: 1em;',
'	}',
'	#hypergrid-dialog div.more-info > p { margin: .5em 0; }',
'',
'	#hypergrid-dialog .tabz ul {',
'		padding-left: 1.5em;',
'		list-style-type: circle;',
'		font-weight: bold;',
'	}',
'	#hypergrid-dialog .tabz ul > li > ul {',
'		list-style-type: disc;',
'		font-weight: normal;',
'	}',
'	#hypergrid-dialog .tabz li {',
'		margin: .3em 0;',
'	}',
'	#hypergrid-dialog .tabz li > code {',
'		background: #e0e0e0;',
'		margin: 0 .1em;',
'		padding: 0 5px;',
'		border-radius: 4px;',
'	}',
'',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > div:last-child ol {',
'		padding-left: 1.6em;',
'	}',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > div:last-child ol > li > label {',
'		width: 100%;',
'		font-weight: normal;',
'		display: inline;',
'	}',
'	#hypergrid-dialog .tabz .filter-tree-warn {',
'		color: darkred;',
'		font-size: smaller;',
'		font-style: italic;',
'		line-height: initial;',
'	}',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > textarea,',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > div:last-child textarea,',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > div:last-child input {',
'		display: block;',
'		position: relative;',
'		min-width: 100%;',
'		max-width: 100%;',
'		box-sizing: border-box;',
'		border: 1px solid black;',
'		padding: .4em .7em;',
'		font-family: monospace;',
'		font-size: 9pt;',
'		margin-top: 3px;',
'	}',
'	#hypergrid-dialog .tabz > section.filter-expression-syntax > textarea {',
'		height: 96%;',
'	}',
'	#hypergrid-dialog .tabz a.filter-copy {',
'		display: block;',
'		float: right;',
'		font-size: smaller;',
'	}',
'	#hypergrid-dialog .tabz a.filter-copy:before {',
'		content: \'(copy\';',
'	}',
'	#hypergrid-dialog .tabz a.filter-copy:after {',
'		content: \')\';',
'	}',
'	#hypergrid-dialog .tabz a.filter-copy:active {',
'		color: red;',
'	}',
'</style>',
'',
'<div>',
'	<select id="add-column-filter-subexpression" style="float:right; margin-left:1em; margin-right:4em;">',
'		<option value="">New column filter&hellip;</option>',
'	</select>',
'',
'	<p>',
'		<span>Column Filters</span>',
'		<a class="more-info"></a>',
'	</p>',
'	<div class="more-info">',
'		<p>The table filter can be viewed in the Query Builder or as SQL WHERE clause syntax. Both interfaces manipulate the same underlying filter data structure.</p>',
'		<p>All column filters are AND&rsquo;d together. Each grid row is first qualified by the table filter and then successively qualified by each column filter subexpression.</p>',
'	</div>',
'',
'	<div class="tabz" id="columnFiltersPanel">',
'',
'		<header id="columnsQB" class="default-tab">',
'			Query Builder',
'		</header>',
'',
'		<section>',
'		</section>',
'',
'		<header id="columnsSQL" class="tabz-bg2">',
'			SQL',
'		</header>',
'',
'		<section class="filter-expression-syntax tabz-bg2">',
'			<div>',
'				<p>',
'					<span></span>',
'					<a type="button" class="filter-copy" title="The state of the column filters subtree expressed in SQL syntax (all the column filter subexpressions shown below AND&rsquo;d together).">',
'						all</a>',
'				</p>',
'				<ol></ol>',
'			</div>',
'		</section>',
'',
'		<header id="columnsCQL" class="tabz-bg1">',
'			CQL',
'		</header>',
'',
'		<section class="filter-expression-syntax tabz-bg1">',
'			<p>',
'				<em>',
'					<small>Column filter cells accept a simplified, compact, and intuitive syntax, which is however not as flexible or concise as SQL syntax or using the Query Builder.</small>',
'					<a class="more-info"></a>',
'				</em>',
'			</p>',
'			<div class="more-info">',
'				<ul>',
'					<li>',
'						Simple expressions',
'						<ul>',
'							<li>All simple expressions take the form <i>operator literal</i> or <i>operator identifier</i>. The (left side) column is always implied and is the same for all simple expressions in a compound expression. This is because column filters are always tied to a known column.</li>',
'',
'							<li>If the operator is an equals sign (=), it may be omitted.</li>',
'',
'							<li>Besides operators, no other punctuation is permitted, meaning that no quotation marks and no parentheses.</li>',
'',
'							<li>If a literal exactly matches a column name or alias, the operand is not taken literally and instead refers to the value in that column. (There are properties to control what constitutes such a match: Column name, alias, or either; and the case-sensitivity of the match.)</li>',
'',
'							<li>As literals are unquoted, any operator symbol or operator word (including logical operators for compound expressions) terminates a literal.</li>',
'',
'							<li>An important corollary to the above features is that operators may not appear in literals.</li>',
'						</ul>',
'					</li>',
'',
'					<li>',
'						Compound expressions',
'						<ul>',
'							<li>Compound expressions are formed by connecting simple expressions with the logical operators <code>AND</code>, <code>OR</code>, <code>NOR</code>, or <code>NAND</code> ("not and").</li>',
'',
'							<li>However, all logical operators used in a compound column filter expression must be homogeneous. You may not mix the above logical operators in a single column. (If you need to do this, create a table filter expression instead.)</li>',
'						</ul>',
'					</li>',
'',
'					<li>',
'						Hidden logic',
'						<ul>',
'							<li>If the column is also referenced in a table filter expression (on the left side of a simple expression), the column filter is flagged in its grid cell with a special star character. This is just a flag; it is not part of the syntax. <span style="color:red; font-style:italic">Not yet implemented.</span></li>',
'						</ul>',
'					</li>',
'				</ul>',
'			</div>',
'',
'			<div>',
'				<p><span></span></p>',
'				<ol></ol>',
'			</div>',
'		</section>',
'	</div>',
'</div>',
'',
'<div>',
'	<p>',
'		<span>Table Filter</span>',
'		<a class="more-info"></a>',
'	</p>',
'	<div class="more-info">',
'		<p>The table filter can be viewed in the Query Builder or as SQL WHERE clause syntax. Both interfaces manipulate the same underlying filter data structure.</p>',
'		<p>',
'			These filter subexpressions are both required (<code>AND</code>&rsquo;d together), resulting in a subset of <em>qualified rows</em> which have passed through both filters.',
'			It\'s called a <dfn>tree</dfn> because it contains both <dfn>branches</dfn> and <dfn>leaves</dfn>.',
'			The leaves represent <dfn>conditional expressions</dfn> (or simply <dfn>conditionals</dfn>).',
'			The branches, also known as <dfn>subtrees</dfn>, contain leaves and/or other branches and represent subexpressions that group conditionals together.',
'			Grouped conditionals are evaluated together, before conditionals outside the group.',
'		</p>',
'	</div>',
'',
'	<div class="tabz" id="tableFilterPanel">',
'		<header id="tableQB">',
'			Query Builder',
'		</header>',
'',
'		<section>',
'		</section>',
'',
'		<header id="tableSQL" class="tabz-bg2">',
'			SQL',
'		</header>',
'',
'		<section class="filter-expression-syntax tabz-bg2">',
'			<div>',
'				<p>',
'					SQL WHERE clause syntax with certain restrictions.',
'					<a class="more-info"></a>',
'				</p>',
'				<div class="more-info">',
'					<ul>',
'						<li>',
'							Simple expressions',
'							<ul>',
'								<li>All simple expressions must be of the form <i>column operator literal</i> or <i>column operator identifier</i>. That is, the left side must refer to a column (may not be a literal); whereas the right side may be either.</li>',
'',
'								<li>Column names may be quoted with the currently set quote characters (typically double-quotes). If unquoted, they must consist of classic identifier syntax (alphanumerics and underscore, but not beginning with a numeral).</li>',
'',
'								<li>All literals must be quoted strings (using single quotes). (In a future release we expect to support unquoted numeric syntax for columns explicitly typed as numeric.)</li>',
'							</ul>',
'						</li>',
'',
'						<li>',
'							Compound expressions',
'							<ul>',
'								<li>Compound expressions are formed by connecting simple expressions with the logical operators <code>AND</code> or <code>OR</code>.</li>',
'',
'								<li>However, all logical operators at each level in a complex expression (each parenthesized subexpression) must be homogeneous, <i>i.e.,</i> either <code>AND</code> or <code>OR</code> but not a mixture of the two. In other words, there is no implicit operator precedence; grouping of expressions must always be explicitly stated with parentheses.</li>',
'',
'								<li>The unary logical operator <code>NOT</code> is supoorted before parentheses only. While the Query Builder and the Column Filter allow they syntax <code>&hellip; NOT <i>operator</i> &hellip;</code> (where <code><i>operator</i></code> is <code>IN</code>, <code>LIKE</code>, <i>etc.</i>), these must be expressed here with parenthethes: <code>NOT (&hellip; <i>operator</i> &hellip;)</code>.</li>',
'',
'								<li>While the Query Builder and Column Filter syntax support the pseudo-operators <code>NOR</code> and <code>NAND</code>, in SQL these must be expressed as <code>NOT (&hellip; OR &hellip;)</code> and <code>NOT (&hellip; AND &hellip;)</code>, respectively.</li>',
'',
'								<li>The Query Builder and Column Filter syntax also support the pseudo-operators <code>BEGINS abc</code>, <code>ENDS xyz</code>, and <code>CONTAINS def</code>. These are expressed in SQL by <code>LIKE \'abc%\'</code>, <code>LIKE \'%xyz\'</code>, and <code>LIKE \'%def%\'</code>, respectively.</li>',
'							</ul>',
'						</li>',
'					</ul>',
'				</div>',
'			</div>',
'			<div class="filter-tree-warn"></div>',
'			<textarea></textarea>',
'		</section>',
'',
'	</div>',
'</div>'
].join('\n');

},{}],9:[function(require,module,exports){
'use strict';
var dialogs = require('../dialogs');

module.exports = {
    /**
     * @memberOf Behavior.prototype
     * @desc delegate handling double click to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {string[]} [options] - Forwarded to dialog constructor.
     */
    openDialog: function(dialogName, options) {
        return new dialogs[dialogName](this.grid, options);
    }
};


},{"../dialogs":6}],10:[function(require,module,exports){
'use strict';

exports.editorActivationKeys = ['alt', 'esc'];

},{}],11:[function(require,module,exports){
'use strict';

var _ = require('object-iterators'); // fyi: installs the Array.prototype.find polyfill, as needed

module.exports = {

    /**
     * @summary Sticky hash of dialog options objects.
     * @desc Each key is a dialog name; the value is the options object for that dialog.
     * The default dialog options object has the key `'undefined'`, which is undefined by default; it is set by calling `setDialogOptions` with no `dialogName` parameter.
     * @private
     */
    dialogOptions: {},

    /**
     * @summary Set and/or return a specific dialog options object *or* a default dialog options object.
     *
     * @desc If `options` defined:
     * * If `dialogName` defined: Save the specific dialog's options object.
     * * If `dialogName` undefined: Save the default dialog options object.
     *
     * If `options` is _not_ defined, no new dialog options object will be saved; but a previously saved preset will be returned (after mixing in the default preset if there is one).
     *
     * The default dialog options object is used in two ways:
     * * when a dialog has no options object
     * * as a mix-in base when a dialog does have an options object
     *
     * @param {string} [dialogName] If undefined, `options` defines the default dialog options object.
     *
     * @param {object} [options] If defined, preset the named dialog options object or the default dialog options object if name is undefined.
     *
     * @returns {object} One of:
     * * When `options` undefined, first of:
     *   * previous preset
     *   * default preset
     *   * empty object
     * * When `options` defined, first of:
     *   * mix-in: default preset members + `options` members
     *   * `options` verbatim when default preset undefined
     */
    setDialogOptions: function(dialogName, options) {
        if (typeof dialogName === 'object') {
            options = dialogName;
            dialogName = undefined;
        }
        var defaultOptions = this.dialogOptions.undefined;
        options = options || dialogName && this.dialogOptions[dialogName];
        if (options) {
            this.dialogOptions[dialogName] = options;
            if (defaultOptions) {
                options = _({}).extend(defaultOptions, options); // make a mix-in
            }
        } else {
            options = defaultOptions || {};
        }
        return options;
    },

    /**
     * Options objects are remembered for subsequent use. Alternatively, they can be preset by calling {@link Hypergrid#setDialogOptions|setDialogOptions}.
     * @param {string} dialogName
     * @param {object} [options] - If omitted, use the options object previously given here (or to {@link Hypergrid#setDialogOptions|setDialogOptions}), if any. In any case, the resultant options object, if any, is mixed into the default options object, if there is one.
     */
    openDialog: function(dialogName, options) {
        this.stopEditing();
        options = this.setDialogOptions(dialogName, options);
        options.terminate = function() { // when about-to-be-opened dialog is eventually closed
            delete this.dialog;
        }.bind(this);
        this.dialog = this.behavior.openDialog(dialogName, options);
        this.allowEvents(false);
    },

    // although you can have multiple dialogs open at the same time, the following enforces one at a time (for now)
    toggleDialog: function(newDialogName, options) {
        var dialog = this.dialog,
            oldDialogName = dialog && dialog.$$CLASS_NAME;
        if (!dialog || !this.dialog.close() && oldDialogName !== newDialogName) {
            if (!dialog) {
                // open new dialog now
                this.openDialog(newDialogName, options);
            } else {
                // open new dialog when already-opened dialog finishes closing due to .closeDialog() above
                dialog.terminate = this.openDialog.bind(this, newDialogName, options);
                this.allowEvents(true);
                this.takeFocus();
            }
        }
    }

};

},{"object-iterators":16}],12:[function(require,module,exports){
/* eslint-env browser */

'use strict';

/** @module automat */

var ENCODERS = /%\{(\d+)\}/g; // double $$ to encode

var REPLACERS = /\$\{(.*?)\}/g; // single $ to replace


/**
 * @summary String formatter.
 *
 * @desc String substitution is performed on numbered _replacer_ patterns like `${n}` or _encoder_ patterns like `%{n}` where n is the zero-based `arguments` index. So `${0}` would be replaced with the first argument following `text`.
 *
 * Encoders are just like replacers except the argument is HTML-encoded before being used.
 *
 * To change the format patterns, assign new `RegExp` patterns to `automat.encoders` and `automat.replacers`.
 *
 * @param {string|function} template - A template to be formatted as described above. Overloads:
 * * A string primitive containing the template.
 * * A function to be called with `this` as the calling context. The template is the value returned from this call.
 *
 * @param {...*} [replacements] - Replacement values for numbered format patterns.
 *
 * @return {string} The formatted text.
 *
 * @memberOf module:automat
 */
function automat(template, replacements/*...*/) {
    var hasReplacements = arguments.length > 1;

    // if `template` is a function, convert it to text
    if (typeof template === 'function') {
        template = template.call(this); // non-template function: call it with context and use return value
    }

    if (hasReplacements) {
        var args = arguments;
        template = template.replace(automat.replacersRegex, function(match, key) {
            key -= -1; // convert to number and increment
            return args.length > key ? args[key] : '';
        });

        template = template.replace(automat.encodersRegex, function(match, key) {
            key -= -1; // convert to number and increment
            if (args.length > key) {
                var htmlEncoderNode = document.createElement('DIV');
                htmlEncoderNode.textContent = args[key];
                return htmlEncoderNode.innerHTML;
            } else {
                return '';
            }
        });
    }

    return template;
}

/**
 * @summary Replace contents of `el` with `Nodes` generated from formatted template.
 *
 * @param {string|function} template - See `template` parameter of {@link automat}.
 *
 * @param {HTMLElement} [el] - Node in which to return markup generated from template. If omitted, a new `<div>...</div>` element will be created and returned.
 *
 * @param {...*} [replacements] - Replacement values for numbered format patterns.
 *
 * @return {HTMLElement} The `el` provided or a new `<div>...</div>` element, its `innerHTML` set to the formatted text.
 *
 * @memberOf module:automat
 */
function replace(template, el, replacements/*...*/) {
    var elOmitted = typeof el !== 'object',
        args = Array.prototype.slice.call(arguments, 1);

    if (elOmitted) {
        el = document.createElement('DIV');
        args.unshift(template);
    } else {
        args[0] = template;
    }

    el.innerHTML = automat.apply(null, args);

    return el;
}

/**
 * @summary Append or insert `Node`s generated from formatted template into given `el`.
 *
 * @param {string|function} template - See `template` parameter of {@link automat}.
 *
 * @param {HTMLElement} el
 *
 * @param {Node} [referenceNode=null] Inserts before this element within `el` or at end of `el` if `null`.
 *
 * @param {...*} [replacements] - Replacement values for numbered format patterns.
 *
 * @returns {Node[]} Array of the generated nodes (this is an actual Array instance; not an Array-like object).
 *
 * @memberOf module:automat
 */
function append(template, el, referenceNode, replacements/*...*/) {
    var replacementsStartAt = 3,
        referenceNodeOmitted = typeof referenceNode !== 'object';  // replacements are never objects

    if (referenceNodeOmitted) {
        referenceNode = null;
        replacementsStartAt = 2;
    }

    replacements = Array.prototype.slice.call(arguments, replacementsStartAt);
    var result = [],
        div = replace.apply(null, [template].concat(replacements));

    while (div.childNodes.length) {
        result.push(div.firstChild);
        el.insertBefore(div.firstChild, referenceNode); // removes child from div
    }

    return result;
}

/**
 * Use this convenience wrapper to return the first child node described in `template`.
 *
 * @param {string|function} template - If a function, extract template from comment within.
 *
 * @returns {HTMLElement} The first `Node` in your template.
 *
 * @memberOf module:automat
 */
function firstChild(template, replacements/*...*/) {
    return replace.apply(null, arguments).firstChild;
}

/**
 * Use this convenience wrapper to return the first child element described in `template`.
 *
 * @param {string|function} template - If a function, extract template from comment within.
 *
 * @returns {HTMLElement} The first `HTMLElement` in your template.
 *
 * @memberOf module:automat
 */
function firstElement(template, replacements/*...*/) {
    return replace.apply(null, arguments).firstElementChild;
}

/**
 * @summary Finds string substitution lexemes that require HTML encoding.
 * @desc Modify to suit.
 * @default %{n}
 * @type {RegExp}
 * @memberOf module:automat
 */
automat.encodersRegex = ENCODERS;

/**
 * @summary Finds string substitution lexemes.
 * @desc Modify to suit.
 * @default ${n}
 * @type {RegExp}
 * @memberOf module:automat
 */
automat.replacersRegex = REPLACERS;

automat.format = automat; // if you find using just `automat()` confusing
automat.replace = replace;
automat.append = append;
automat.firstChild = firstChild;
automat.firstElement = firstElement;

module.exports = automat;

},{}],13:[function(require,module,exports){
'use strict';

/* eslint-env browser */

/** @namespace cssInjector */

/**
 * @summary Insert base stylesheet into DOM
 *
 * @desc Creates a new `<style>...</style>` element from the named text string(s) and inserts it but only if it does not already exist in the specified container as per `referenceElement`.
 *
 * > Caveat: If stylesheet is for use in a shadow DOM, you must specify a local `referenceElement`.
 *
 * @returns A reference to the newly created `<style>...</style>` element.
 *
 * @param {string|string[]} cssRules
 * @param {string} [ID]
 * @param {undefined|null|Element|string} [referenceElement] - Container for insertion. Overloads:
 * * `undefined` type (or omitted): injects stylesheet at top of `<head>...</head>` element
 * * `null` value: injects stylesheet at bottom of `<head>...</head>` element
 * * `Element` type: injects stylesheet immediately before given element, wherever it is found.
 * * `string` type: injects stylesheet immediately before given first element found that matches the given css selector.
 *
 * @memberOf cssInjector
 */
function cssInjector(cssRules, ID, referenceElement) {
    if (typeof referenceElement === 'string') {
        referenceElement = document.querySelector(referenceElement);
        if (!referenceElement) {
            throw 'Cannot find reference element for CSS injection.';
        }
    } else if (referenceElement && !(referenceElement instanceof Element)) {
        throw 'Given value not a reference element.';
    }

    var container = referenceElement && referenceElement.parentNode || document.head || document.getElementsByTagName('head')[0];

    if (ID) {
        ID = cssInjector.idPrefix + ID;

        if (container.querySelector('#' + ID)) {
            return; // stylesheet already in DOM
        }
    }

    var style = document.createElement('style');
    style.type = 'text/css';
    if (ID) {
        style.id = ID;
    }
    if (cssRules instanceof Array) {
        cssRules = cssRules.join('\n');
    }
    cssRules = '\n' + cssRules + '\n';
    if (style.styleSheet) {
        style.styleSheet.cssText = cssRules;
    } else {
        style.appendChild(document.createTextNode(cssRules));
    }

    if (referenceElement === undefined) {
        referenceElement = container.firstChild;
    }

    container.insertBefore(style, referenceElement);

    return style;
}

/**
 * @summary Optional prefix for `<style>` tag IDs.
 * @desc Defaults to `'injected-stylesheet-'`.
 * @type {string}
 * @memberOf cssInjector
 */
cssInjector.idPrefix = 'injected-stylesheet-';

// Interface
module.exports = cssInjector;

},{}],14:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var automat = require('automat');

/**
 * @summary Injects the named stylesheet into `<head>`.
 * @desc Stylesheets are inserted consecutively at end of `<head>` unless `before === true` (or omitted and `injectStylesheetTemplate.before` truthy) in which case they are inserted consecutively before first stylesheet found in `<head>` (if any) at load time.
 *
 * The calling context (`this`) is a stylesheet registry.
 * If `this` is undefined, the global stylesheet registry (css/index.js) is used.
 * @this {object}
 * @param {boolean} [before=injectStylesheetTemplate.before] - Add stylesheet before intially loaded stylesheets.
 *
 * _If omitted:_
 * 1. `id` is promoted to first argument position
 * 2. `injectStylesheetTemplate.before` is `true` by default
 * @param {string} id - The name of the style sheet in `this`, a stylesheet "registry" (hash of stylesheets).
 * @returns {Element|*}
 */
function injectStylesheetTemplate(before, id) {
    var optionalArgsStartAt, stylesheet, head, refNode, css, args,
        prefix = injectStylesheetTemplate.prefix;

    if (typeof before === 'boolean') {
        optionalArgsStartAt = 2;
    } else {
        id = before;
        before = injectStylesheetTemplate.before;
        optionalArgsStartAt = 1;
    }

    stylesheet = document.getElementById(prefix + id);

    if (!stylesheet) {
        head = document.querySelector('head');

        if (before) {
            // note position of first stylesheet
            refNode = Array.prototype.slice.call(head.children).find(function(child) {
                var id = child.getAttribute('id');
                return child.tagName === 'STYLE' && (!id || id.indexOf(prefix) !== prefix) ||
                    child.tagName === 'LINK' && child.getAttribute('rel') === 'stylesheet';
            });
        }

        css = this[id];

        if (!css) {
            throw 'Expected to find member `' + id + '` in calling context.';
        }

        args = [
            '<style>\n' + css + '\n</style>\n',
            head,
            refNode || null // explicitly null per https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore
        ];

        if (arguments.length > 1) {
            args = args.concat(Array.prototype.slice.call(arguments, optionalArgsStartAt));
        }

        stylesheet = automat.append.apply(null, args)[0];
        stylesheet.id = prefix + id;
    }

    return stylesheet;
}

injectStylesheetTemplate.before = true;
injectStylesheetTemplate.prefix = 'injected-stylesheet-';

module.exports = injectStylesheetTemplate;

},{"automat":12}],15:[function(require,module,exports){
// list-dragon node module
// https://github.com/joneit/list-dragon

/* eslint-env node, browser */

'use strict';

var cssInjector = require('css-injector');
var format = require('templex');

var REVERT_TO_STYLESHEET_VALUE = null;  // null removes the style

var transform, timer, scrollVelocity, cssListDragon;

/* inject:css */
cssListDragon = 'div.dragon-list{position:relative;background-color:#fff}div.dragon-list>div,div.dragon-list>ul{position:absolute;left:0;right:0}div.dragon-list>div{text-align:center;background-color:#00796b;color:#fff;box-shadow:0 3px 6px rgba(0,0,0,.16),0 3px 6px rgba(0,0,0,.23);overflow:hidden;white-space:nowrap}div.dragon-list>ul{overflow-y:auto;bottom:0;margin:0;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.24)}div.dragon-list>ul>li,li.dragon-pop{white-space:nowrap;list-style-type:none;border:0 solid #f4f4f4;border-bottom:1px solid #e0e0e0;cursor:move;transition:border-top-width .2s}div.dragon-list>ul>li:last-child{height:0;border-bottom:none}li.dragon-pop{position:fixed;background-color:#fff;border:1px solid #e0e0e0;left:0;top:0;overflow-x:hidden;box-shadow:rgba(0,0,0,.188235) 0 10px 20px,rgba(0,0,0,.227451) 0 6px 6px}';
/* endinject */

/**
 * @constructor ListDragon
 *
 * @desc This object services a set of item lists that allow dragging and dropping items within and between lists in a set.
 *
 * Two strategies are supported:
 *
 * 1. Supply your own HTML markup and let the API build the item models for you.
 *    To use this strategy, script your HTML and provide one of these:
 *    * an array of all the list item (`<li>`) tags
 *    * a CSS selector that points to all the list item tags
 * 2. Supply your own item models and let the API build the HTML markup for you.
 *    To use this strategy, provide an array of model lists.
 *
 * The new ListDragon object's `modelLists` property references the array of model lists the API constructed for you in strategy #1 or the array of model lists you supplied for strategy #2.
 *
 * After the user performs a successful drag-and-drop operation, the position of the model references within the `modelLists` array is rearranged. (The models themselves are the original objects as supplied in the model lists; they are not rebuilt or altered in any way. Just the references to them are moved around.)
 *
 * @param {string|Element[]|modelListType[]} selectorOrModelLists - You must supply one of the items in **bold** below:
 *
 * 1. _For strategy #1 above (API creates models from supplied elements):_ All the list item (`<li>`) DOM elements of all the lists you want the new object to manage, as either:
 *    1. **A CSS selector;** _or_
 *    2. **An array of DOM elements**
 * 2. _For strategy #2 above (API creates elements from supplied models):_ **An array of model lists,** each of which is in one of the following forms:
 *    1. An array of item models (with various option properties hanging off of it); _and/or_
 *    2. A {@link modelListType} object with those same various option properties including the required `models` property containing that same array of item models.
 *
 * In either case (2.1 or 2.2), each element of such arrays of item models may take the form of:
 * * A string primitive; _or_
 * * A {@link itemModelType} object with a various option properties including the required `label` property containing a string primitive.
 *
 * Regarding these string primitives, each is either:
 * * A string to be displayed in the list item; _or_
 * * A format string with other property values merged in, the result of which is to be displayed in the list item.
 *
 * @param {object} [options={}] - You may supply "global" template variables here, representing the "outer scope," after first searching each model and then each model list.
 * @param {undefined|null|Element|string} [cssStylesheetReferenceElement] - Determines where to insert the stylesheet. (This is the only formal option.) Passed to css-injector, the overloads are (from css-injector docs):
 * * `undefined` type (or omitted): injects stylesheet at top of `<head>...</head>` element
 * * `null` value: injects stylesheet at bottom of `<head>...</head>` element
 * * `Element` type: injects stylesheet immediately before given element, wherever it is found.
 * * `string` type: injects stylesheet immediately before given first element found that matches the given css selector.
 */
function ListDragon(selectorOrModelLists, options) {

    if (!(this instanceof ListDragon)) {
        throw error('Not called with "new" keyword.');
    }

    var self = this, modelLists, items;

    options = options || {};

    if (typeof selectorOrModelLists === 'string') {
        items = toArray(document.querySelectorAll(selectorOrModelLists));
        modelLists = createModelListsFromListElements(items);
    } else if (selectorOrModelLists[0] instanceof Element) {
        items = toArray(selectorOrModelLists);
        modelLists = createModelListsFromListElements(items);
    } else {
        // param is array of model lists
        // build new <ul> element(s) for each list and put in `.modelLists`;
        // fill `.items` array with <li> elements from these new <ul> elements
        items = [];
        modelLists = createListElementsFromModelLists(selectorOrModelLists, options);
        modelLists.forEach(function (list) {
            items = items.concat(toArray(list.element.querySelectorAll('li')));
        });
    }

    // grab wheel events and don't let 'em bubble
    modelLists.forEach(function (modelList) {
        modelList.element.addEventListener('wheel', captureEvent);
    });

    items.forEach(function (itemElement, index) {
        var item = (itemElement !== itemElement.parentElement.lastElementChild)
            ? self.addEvt(itemElement, 'mousedown', itemElement, true)
            : { element: itemElement };

        /* `item.model` not currently needed so commented out here.
         * (Originally used for rebuilding modelLists for final
         * reporting, modelLists are now spliced on every successful
         * drag-and-drop operation so they're always up to date.)

         var origin = this.itemCoordinates(itemElement);
         item.model = this.modelLists[origin.list].models[origin.item];

         */

        items[index] = item;
    });

    transform = 'transform' in items[0].element.style
        ? 'transform' // Chrome 45 and Firefox 40
        : '-webkit-transform'; // Safari 8

    // set up the new object
    this.modelLists = modelLists;
    this.items = items;
    this.bindings = {};
    this.callback = {};

    cssInjector(cssListDragon, 'list-dragon-base', options.cssStylesheetReferenceElement);

}

ListDragon.prototype = {

    addEvt: function (target, type, listener, doNotBind) {
        var binding = {
            handler: handlers[type].bind(target, this),
            element: listener || window
        };

        if (!doNotBind) {
            this.bindings[type] = binding;
        }

        binding.element.addEventListener(type, binding.handler);

        return binding;
    },

    removeEvt: function (type) {
        var binding = this.bindings[type];
        delete this.bindings[type];
        binding.element.removeEventListener(type, binding.handler);
    },

    removeAllEventListeners: function () {
        // remove drag & drop events (mousemove, mouseup, and transitionend)
        for (var type in this.bindings) {
            var binding = this.bindings[type];
            binding.element.removeEventListener(type, binding.handler);
        }
        // remove the mousedown events from all list items
        this.items.forEach(function (item) {
            if (item.handler) {
                item.element.removeEventListener('mousedown', item.handler);
            }
        });
        // wheel events on the list elements
        this.modelLists.forEach(function (modelList) {
            modelList.element.removeEventListener('wheel', captureEvent);
        });
    },

    pointInListRects: function (point) {
        return this.modelLists.find(function (modelList) {
            var rect = modelList.element.getBoundingClientRect();

            rect = {
                left:   window.scrollX + rect.left,
                top:    window.scrollY + rect.top,
                right:  window.scrollX + rect.right,
                bottom: window.scrollY + rect.bottom,
                width:  rect.width,
                height: rect.height
            };

            modelList.rect = rect;

            if (pointInRect(point, rect)) {
                modelList.rect = rect;
                return true; // found
            } else {
                return false;
            }
        });
    },

    pointInItemRects: function (point, except1, except2) {
        return this.items.find(function (item) {
            var element = item.element;
            return (
                element !== except1 &&
                element !== except2 &&
                pointInRect(point, item.rect)
            );
        });
    },

    // get positions of all list items in page coords (normalized for window and list scrolling)
    getAllItemBoundingRects: function () {
        var modelLists = this.modelLists, height;
        this.items.forEach(function (item) {
            var itemElement = item.element,
                listElement = itemElement.parentElement,
                list = modelLists.find(function (list) { return list.element === listElement; });

            if (
                // omitted: default to true
                list.isDropTarget === undefined ||

                // function: use return value
                typeof list.isDropTarget === 'function' && list.isDropTarget() ||

                // otherwise: use truthiness of given value
                list.isDropTarget
            ) {
                var rect = itemElement.getBoundingClientRect(),
                    bottom = rect.bottom;

                if (itemElement === listElement.lastElementChild) {
                    bottom = listElement.getBoundingClientRect().bottom;
                    if (bottom < rect.top) {
                        bottom = rect.top + (height || 50);
                    }
                } else {
                    height = rect.height;
                }

                rect = {
                    left:   window.scrollX + rect.left,
                    right:  window.scrollX + rect.right,
                    top:    window.scrollY + rect.top    + listElement.scrollTop,
                    bottom: window.scrollY + bottom + listElement.scrollTop
                };

                item.rect = rect;
            }
        });
    },

    reinsert: function (target) {
        var style = target.style;
        style.width = style[transform] = style.transition = REVERT_TO_STYLESHEET_VALUE;

        target.classList.remove('dragon-pop');

        this.drop.style.transitionDuration = '0s';
        this.drop.style.borderTopWidth = REVERT_TO_STYLESHEET_VALUE;
        this.drop.parentElement.insertBefore(target, this.drop);

        delete this.drop;
    },

    // return an object { item: <item index within list>, list: <list index within list of lists> }
    itemCoordinates: function (item) {
        var listElement = item.parentElement,
            coords = { item: 0 };

        while ((item = item.previousElementSibling)) {
            ++coords.item;
        }

        this.modelLists.find(function (list, index) {
            coords.list = index;
            return list.element === listElement; // stop when we find the one we belong to
        });

        return coords;
    }

};

var handlers = {
    mousedown: function (dragon, evt) {

        evt.stopPropagation();
        evt.preventDefault();  //prevents user selection of rendered nodes during drag

        if (dragon.drop) {
            return;
        }

        var rect = this.getBoundingClientRect();

        dragon.rect = rect = {
            left:   Math.round(rect.left - 1),
            top:    Math.round(rect.top - 1),
            right:  Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width:  Math.round(rect.width),
            height: Math.round(rect.height)
        };

        dragon.pin = {
            x: window.scrollX + evt.clientX,
            y: window.scrollY + evt.clientY
        };

        dragon.origin = dragon.itemCoordinates(this);

        if (dragon.callback.grabbed) {
            dragon.callback.grabbed.call(this, dragon);
        }

        dragon.getAllItemBoundingRects();

        dragon.drop = this.nextElementSibling;
        dragon.drop.style.transitionDuration = '0s';
        dragon.drop.style.borderTopWidth = rect.height + 'px';

        this.style.width = rect.width + 'px';
        this.style.transitionDuration = '0s';
        this.style[transform] = translate(
            rect.left - window.scrollX,
            rect.top  - window.scrollY
        );
        this.classList.add('dragon-pop');
        this.style.zIndex = window.getComputedStyle(dragon.modelLists[0].container.parentElement).zIndex;

        if (!dragon.container) {
            // walk back to closest shadow root OR body tag OR root tag
            var container = this;
            while (container.parentNode) {
                container = container.parentNode;
                if (
                    typeof ShadowRoot !== 'undefined' && container instanceof ShadowRoot ||
                    container.tagName === 'BODY'
                ){
                    break;
                }
            }
            dragon.container = container;
        }

        dragon.container.appendChild(this);

        rect.left   += window.scrollX;
        rect.top    += window.scrollY;
        rect.right  += window.scrollX;
        rect.bottom += window.scrollY;

        dragon.addEvt(this, 'mousemove');
        dragon.addEvt(this, 'mouseup');
    },

    mousemove: function (dragon, evt) {
        dragon.drop.style.transition = REVERT_TO_STYLESHEET_VALUE;

        var hoverList = dragon.pointInListRects({ x: evt.clientX, y: evt.clientY }) || dragon.mostRecentHoverList;

        if (hoverList) {
            var dx = evt.clientX - dragon.pin.x,
                dy = evt.clientY - dragon.pin.y;

            dragon.mostRecentHoverList = hoverList;

            var maxScrollY = hoverList.element.scrollHeight - hoverList.rect.height,
                y = evt.clientY + window.scrollY,
                magnitude;

            if (maxScrollY > 0) {
                // list is scrollable (is taller than rect)
                if (hoverList.element.scrollTop > 0 && (magnitude = y - (hoverList.rect.top + 5)) < 0) {
                    // mouse near or above top and list is not scrolled to top yet
                    resetAutoScrollTimer(magnitude, 0, hoverList.element);
                } else if (hoverList.element.scrollTop < maxScrollY && (magnitude = y - (hoverList.rect.bottom - 1 - 5)) > 0) {
                    // mouse near or below bottom and list not scrolled to bottom yet
                    resetAutoScrollTimer(magnitude, maxScrollY, hoverList.element);
                } else {
                    // mouse inside
                    resetAutoScrollTimer();
                }
            }

            var other = dragon.pointInItemRects({
                x: evt.clientX,
                y: dragon.rect.bottom + window.scrollY + dy + hoverList.element.scrollTop
            }, this, dragon.drop);

            this.style[transform] = translate(
                dragon.rect.left - window.scrollX + dx,
                dragon.rect.top - window.scrollY + dy
            );

            if (other) {
                var element = other.element;
                element.style.transition = REVERT_TO_STYLESHEET_VALUE;
                element.style.borderTopWidth = dragon.drop.style.borderTopWidth;
                dragon.drop.style.borderTopWidth = null;
                dragon.drop = element;
            }
        }
    },

    mouseup: function (dragon, evt) {
        resetAutoScrollTimer();
        dragon.removeEvt('mousemove');
        dragon.removeEvt('mouseup');

        evt.stopPropagation();

        var newRect = this.getBoundingClientRect();

        if (
            window.scrollX + newRect.left === dragon.rect.left &&
            window.scrollY + newRect.top === dragon.rect.top
        ) {
            dragon.reinsert(this);
        } else {
            var dropRect = dragon.drop.getBoundingClientRect();

            dragon.addEvt(this, 'transitionend', this);
            this.style.transitionDuration = REVERT_TO_STYLESHEET_VALUE; //reverts to 200ms
            this.style.transitionProperty = transform;
            this.style[transform] = translate(
                dropRect.left - window.scrollX,
                dropRect.top - window.scrollY
            );
        }
    },

    transitionend: function (dragon, evt) {
        if (evt.propertyName === transform) {
            dragon.removeEvt('transitionend');
            dragon.reinsert(this);

            this.style.transitionProperty = REVERT_TO_STYLESHEET_VALUE; //reverts to border-top-width

            var originList = dragon.modelLists[dragon.origin.list];
            var model = originList.splice(dragon.origin.item, 1)[0];
            var destination = dragon.itemCoordinates(this);
            var destinationList = dragon.modelLists[destination.list];
            var interListDrop = originList !== destinationList;
            var listChanged = interListDrop || dragon.origin.item !== destination.item;
            destinationList.splice(destination.item, 0, model);

            if (listChanged) {
                originList.element.dispatchEvent(new CustomEvent('listchanged'));
                if (interListDrop) {
                    destinationList.element.dispatchEvent(new CustomEvent('listchanged'));
                }
            }

            if (dragon.callback.dropped) {
                dragon.callback.dropped.call(this, dragon);
            }
        }
    }
};

function resetAutoScrollTimer(magnitude, limit, element) {
    if (!magnitude) {
        clearInterval(timer);
        scrollVelocity = 0;
    } else {
        var changeDirection =
            scrollVelocity  <  0 && magnitude  >= 0 ||
            scrollVelocity === 0 && magnitude !== 0 ||
            scrollVelocity  >  0 && magnitude  <= 0;
        scrollVelocity = magnitude > 0 ? Math.min(50, magnitude) : Math.max(-50, magnitude);
        if (changeDirection) {
            clearInterval(timer);
            timer = setInterval(function (limit) {
                var scrollTop = element.scrollTop + scrollVelocity;
                if (scrollVelocity < 0 && scrollTop < limit || scrollVelocity > 0 && scrollTop > limit) {
                    element.scrollTop = limit;
                    clearInterval(timer);
                } else {
                    element.scrollTop = scrollTop;
                }
            }, 125);
        }
    }
}

function toArray(arrayLikeObject) {
    return Array.prototype.slice.call(arrayLikeObject);
}

function pointInRect(point, rect) {
    return rect.top <= point.y && point.y <= rect.bottom
        && rect.left <= point.x && point.x <= rect.right;
}

function translate(left, top) {
    return 'translate('
        + Math.floor(left + window.scrollX) + 'px,'
        + Math.floor(top + window.scrollY) + 'px)';
}

function htmlEncode(string) {
    var textNode = document.createTextNode(string);

    return document
        .createElement('a')
        .appendChild(textNode)
        .parentNode
        .innerHTML;
}

/**
 * Creates `<ul>...</ul>` elements and inserts them into an `element` property on each model.
 * @param {object} modelLists
 * @returns `modelLists`
 */
function createListElementsFromModelLists(modelLists, options) {
    var templateLabel = options.label || '{label}';

    modelLists.forEach(function (modelList, listIndex) {
        var listLabel = modelList.label || templateLabel,
            listHtmlEncode = modelList.htmlEncode !== undefined && modelList.htmlEncode || options.htmlEncode,
            container = document.createElement('div'),
            listElement = document.createElement('ul');

        if (modelList.models) {
            Object.keys(modelList).forEach(function (key) {
                if (key !== 'models') {
                    modelList.models[key] = modelList[key];
                }
            });
            modelLists[listIndex] = modelList = modelList.models;
        } else if (modelList instanceof Array) {
            modelList.models = modelList; // point to self
        } else {
            throw error('List [{1}] not an array of models (with or without additional properties) OR ' +
                'an object (with a `models` property containing an array of models).', listIndex);
        }

        modelList.forEach(function (model) {
            var modelLabel = model.label || listLabel,
                modelHtmlEncode = model.htmlEncode !== undefined && model.htmlEncode || listHtmlEncode,
                modelObject = typeof model === 'object' ? model : { label: model},
                label = format.call([modelObject, modelList, options], modelLabel),
                itemElement = document.createElement('li');

            itemElement.innerHTML = modelHtmlEncode ? htmlEncode(label) : label;

            listElement.appendChild(itemElement);
        });

        // append the final "fencepost" item -- drop target at bottom of list after all items
        var itemElement = document.createElement('li');
        itemElement.innerHTML = '&nbsp;';
        listElement.appendChild(itemElement);

        // append header to container
        if (modelList.title) {
            var header = document.createElement('div');
            header.innerHTML = listHtmlEncode ? htmlEncode(modelList.title) : modelList.title;
            container.appendChild(header);
        }

        container.appendChild(listElement);
        container.className = modelList.cssClassNames || options.cssClassNames || 'dragon-list';
        modelList.element = listElement;
        modelList.container = container;
    });

    return modelLists;
}

/**
 * Create a `.modelLists` array with these <li> elements' parent <ul> elements
 * @param {Element[]} listItemElements
 * @returns {Array}
 */
function createModelListsFromListElements(listItemElements) {
    var modelLists = [];

    listItemElements.forEach(function (itemElement) {
        var listElement = itemElement.parentElement,
            container = listElement.parentElement,
            models = [];
        if (!modelLists.find(function (list) { return list.element === listElement; })) {
            toArray(listElement.querySelectorAll('li')).forEach(function (itemElement) {
                if (itemElement !== listElement.lastElementChild) {
                    models.push(itemElement.innerHTML);
                }
            });
            models.element = listElement;
            models.container = container;
            modelLists.push(models);
        }
    });

    return modelLists;
}

function captureEvent(evt) {
    evt.stopPropagation();
}

function error() {
    return 'list-dragon: ' + format.apply(this, Array.prototype.slice.call(arguments));
}

// this interface consists solely of the prototypal object constructor
module.exports = ListDragon;

},{"css-injector":13,"templex":20}],16:[function(require,module,exports){
/* object-iterators.js - Mini Underscore library
 * by Jonathan Eiten
 *
 * The methods below operate on objects (but not arrays) similarly
 * to Underscore (http://underscorejs.org/#collections).
 *
 * For more information:
 * https://github.com/joneit/object-iterators
 */

'use strict';

/**
 * @constructor
 * @summary Wrap an object for one method call.
 * @Desc Note that the `new` keyword is not necessary.
 * @param {object|null|undefined} object - `null` or `undefined` is treated as an empty plain object.
 * @return {Wrapper} The wrapped object.
 */
function Wrapper(object) {
    if (object instanceof Wrapper) {
        return object;
    }
    if (!(this instanceof Wrapper)) {
        return new Wrapper(object);
    }
    this.originalValue = object;
    this.o = object || {};
}

/**
 * @name Wrapper.chain
 * @summary Wrap an object for a chain of method calls.
 * @Desc Calls the constructor `Wrapper()` and modifies the wrapper for chaining.
 * @param {object} object
 * @return {Wrapper} The wrapped object.
 */
Wrapper.chain = function (object) {
    var wrapped = Wrapper(object); // eslint-disable-line new-cap
    wrapped.chaining = true;
    return wrapped;
};

Wrapper.prototype = {
    /**
     * Unwrap an object wrapped with {@link Wrapper.chain|Wrapper.chain()}.
     * @return {object|null|undefined} The value originally wrapped by the constructor.
     * @memberOf Wrapper.prototype
     */
    value: function () {
        return this.originalValue;
    },

    /**
     * @desc Mimics Underscore's [each](http://underscorejs.org/#each) method: Iterate over the members of the wrapped object, calling `iteratee()` with each.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function is undefined; an `.each` loop cannot be broken out of (use {@link Wrapper#find|.find} instead).
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `iteratee`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {Wrapper} The wrapped object for chaining.
     * @memberOf Wrapper.prototype
     */
    each: function (iteratee, context) {
        var o = this.o;
        Object.keys(o).forEach(function (key) {
            iteratee.call(this, o[key], key, o);
        }, context || o);
        return this;
    },

    /**
     * @desc Mimics Underscore's [find](http://underscorejs.org/#find) method: Look through each member of the wrapped object, returning the first one that passes a truth test (`predicate`), or `undefined` if no value passes the test. The function returns the value of the first acceptable member, and doesn't necessarily traverse the entire object.
     * @param {function} predicate - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function should be truthy if the member passes the test and falsy otherwise.
     * @param {object} [context] - If given, `predicate` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} The found property's value, or undefined if not found.
     * @memberOf Wrapper.prototype
     */
    find: function (predicate, context) {
        var o = this.o;
        var result;
        if (o) {
            result = Object.keys(o).find(function (key) {
                return predicate.call(this, o[key], key, o);
            }, context || o);
            if (result !== undefined) {
                result = o[result];
            }
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [filter](http://underscorejs.org/#filter) method: Look through each member of the wrapped object, returning the values of all members that pass a truth test (`predicate`), or empty array if no value passes the test. The function always traverses the entire object.
     * @param {function} predicate - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function should be truthy if the member passes the test and falsy otherwise.
     * @param {object} [context] - If given, `predicate` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} An array containing the filtered values.
     * @memberOf Wrapper.prototype
     */
    filter: function (predicate, context) {
        var o = this.o;
        var result = [];
        if (o) {
            Object.keys(o).forEach(function (key) {
                if (predicate.call(this, o[key], key, o)) {
                    result.push(o[key]);
                }
            }, context || o);
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [map](http://underscorejs.org/#map) method: Produces a new array of values by mapping each value in list through a transformation function (`iteratee`). The function always traverses the entire object.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with three arguments: `(value, key, object)`. The return value of this function is concatenated to the end of the new array.
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `predicate`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} An array containing the filtered values.
     * @memberOf Wrapper.prototype
     */
    map: function (iteratee, context) {
        var o = this.o;
        var result = [];
        if (o) {
            Object.keys(o).forEach(function (key) {
                result.push(iteratee.call(this, o[key], key, o));
            }, context || o);
        }
        return result;
    },

    /**
     * @desc Mimics Underscore's [reduce](http://underscorejs.org/#reduce) method: Boil down the values of all the members of the wrapped object into a single value. `memo` is the initial state of the reduction, and each successive step of it should be returned by `iteratee()`.
     * @param {function} iteratee - For each member of the wrapped object, this function is called with four arguments: `(memo, value, key, object)`. The return value of this function becomes the new value of `memo` for the next iteration.
     * @param {*} [memo] - If no memo is passed to the initial invocation of reduce, the iteratee is not invoked on the first element of the list. The first element is instead passed as the memo in the invocation of the iteratee on the next element in the list.
     * @param {object} [context] - If given, `iteratee` is bound to this object. In other words, this object becomes the `this` value in the calls to `iteratee`. (Otherwise, the `this` value will be the unwrapped object.)
     * @return {*} The value of `memo` "reduced" as per `iteratee`.
     * @memberOf Wrapper.prototype
     */
    reduce: function (iteratee, memo, context) {
        var o = this.o;
        if (o) {
            Object.keys(o).forEach(function (key, idx) {
                memo = (!idx && memo === undefined) ? o[key] : iteratee(memo, o[key], key, o);
            }, context || o);
        }
        return memo;
    },

    /**
     * @desc Mimics Underscore's [extend](http://underscorejs.org/#extend) method: Copy all of the properties in each of the `source` object parameter(s) over to the (wrapped) destination object (thus mutating it). It's in-order, so the properties of the last `source` object will override properties with the same name in previous arguments or in the destination object.
     * > This method copies own members as well as members inherited from prototype chain.
     * @param {...object|null|undefined} source - Values of `null` or `undefined` are treated as empty plain objects.
     * @return {Wrapper|object} The wrapped destination object if chaining is in effect; otherwise the unwrapped destination object.
     * @memberOf Wrapper.prototype
     */
    extend: function (source) {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function (object) {
            if (object) {
                for (var key in object) {
                    o[key] = object[key];
                }
            }
        });
        return this.chaining ? this : o;
    },

    /**
     * @desc Mimics Underscore's [extendOwn](http://underscorejs.org/#extendOwn) method: Like {@link Wrapper#extend|extend}, but only copies its "own" properties over to the destination object.
     * @param {...object|null|undefined} source - Values of `null` or `undefined` are treated as empty plain objects.
     * @return {Wrapper|object} The wrapped destination object if chaining is in effect; otherwise the unwrapped destination object.
     * @memberOf Wrapper.prototype
     */
    extendOwn: function (source) {
        var o = this.o;
        Array.prototype.slice.call(arguments).forEach(function (object) {
            Wrapper(object).each(function (val, key) { // eslint-disable-line new-cap
                o[key] = val;
            });
        });
        return this.chaining ? this : o;
    }
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) { // eslint-disable-line no-extend-native
        if (this === null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}

module.exports = Wrapper;

},{}],17:[function(require,module,exports){
'use strict';

/** @module overrider */

/**
 * Mixes members of all `sources` into `target`, handling getters and setters properly.
 *
 * Any number of `sources` objects may be given and each is copied in turn.
 *
 * @example
 * var overrider = require('overrider');
 * var target = { a: 1 }, source1 = { b: 2 }, source2 = { c: 3 };
 * target === overrider(target, source1, source2); // true
 * // target object now has a, b, and c; source objects untouched
 *
 * @param {object} object - The target object to receive sources.
 * @param {...object} [sources] - Object(s) containing members to copy to `target`. (Omitting is a no-op.)
 * @returns {object} The target object (`target`)
 */
function overrider(target, sources) { // eslint-disable-line no-unused-vars
    for (var i = 1; i < arguments.length; ++i) {
        mixIn.call(target, arguments[i]);
    }

    return target;
}

/**
 * Mix `this` members into `target`.
 *
 * @example
 * // A. Simple usage (using .call):
 * var mixInTo = require('overrider').mixInTo;
 * var target = { a: 1 }, source = { b: 2 };
 * target === overrider.mixInTo.call(source, target); // true
 * // target object now has both a and b; source object untouched
 *
 * @example
 * // B. Semantic usage (when the source hosts the method):
 * var mixInTo = require('overrider').mixInTo;
 * var target = { a: 1 }, source = { b: 2, mixInTo: mixInTo };
 * target === source.mixInTo(target); // true
 * // target object now has both a and b; source object untouched
 *
 * @this {object} Target.
 * @param target
 * @returns {object} The target object (`target`)
 * @memberOf module:overrider
 */
function mixInTo(target) {
    var descriptor;
    for (var key in this) {
        if ((descriptor = Object.getOwnPropertyDescriptor(this, key))) {
            Object.defineProperty(target, key, descriptor);
        }
    }
    return target;
}

/**
 * Mix `source` members into `this`.
 *
 * @example
 * // A. Simple usage (using .call):
 * var mixIn = require('overrider').mixIn;
 * var target = { a: 1 }, source = { b: 2 };
 * target === overrider.mixIn.call(target, source) // true
 * // target object now has both a and b; source object untouched
 *
 * @example
 * // B. Semantic usage (when the target hosts the method):
 * var mixIn = require('overrider').mixIn;
 * var target = { a: 1, mixIn: mixIn }, source = { b: 2 };
 * target === target.mixIn(source) // true
 * // target now has both a and b (and mixIn); source untouched
 *
 * @param source
 * @returns {object} The target object (`this`)
 * @memberOf overrider
 * @memberOf module:overrider
 */
function mixIn(source) {
    var descriptor;
    for (var key in source) {
        if ((descriptor = Object.getOwnPropertyDescriptor(source, key))) {
            Object.defineProperty(this, key, descriptor);
        }
    }
    return this;
}

overrider.mixInTo = mixInTo;
overrider.mixIn = mixIn;

module.exports = overrider;

},{}],18:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var REGEXP_INDIRECTION = /^(\w+)\((\w+)\)$/;  // finds complete pattern a(b) where both a and b are regex "words"

/** @typedef {object} valueItem
 * You should supply both `name` and `alias` but you could omit one or the other and whichever you provide will be used for both.
 * > If you only give the `name` property, you might as well just give a string for {@link menuItem} rather than this object.
 * @property {string} [name=alias] - Value of `value` attribute of `<option>...</option>` element.
 * @property {string} [alias=name] - Text of `<option>...</option>` element.
 * @property {string} [type] One of the keys of `this.converters`. If not one of these (including `undefined`), field values will be tested with a string comparison.
 * @property {boolean} [hidden=false]
 */

/** @typedef {object|menuItem[]} submenuItem
 * @summary Hierarchical array of select list items.
 * @desc Data structure representing the list of `<option>...</option>` and `<optgroup>...</optgroup>` elements that make up a `<select>...</select>` element.
 *
 * > Alternate form: Instead of an object with a `menu` property containing an array, may itself be that array. Both forms have the optional `label` property.
 * @property {string} [label] - Defaults to a generated string of the form "Group n[.m]..." where each decimal position represents a level of the optgroup hierarchy.
 * @property {menuItem[]} submenu
 */

/** @typedef {string|valueItem|submenuItem} menuItem
 * May be one of three possible types that specify either an `<option>....</option>` element or an `<optgroup>....</optgroup>` element as follows:
 * * If a `string`, specifies the text of an `<option>....</option>` element with no `value` attribute. (In the absence of a `value` attribute, the `value` property of the element defaults to the text.)
 * * If shaped like a {@link valueItem} object, specifies both the text and value of an `<option....</option>` element.
 * * If shaped like a {@link submenuItem} object (or its alternate array form), specifies an `<optgroup>....</optgroup>` element.
 */

/**
 * @summary Builds a new menu pre-populated with items and groups.
 * @desc This function creates a new pop-up menu (a.k.a. "drop-down"). This is a `<select>...</select>` element, pre-populated with items (`<option>...</option>` elements) and groups (`<optgroup>...</optgroup>` elements).
 * > Bonus: This function also builds `input type=text` elements.
 * > NOTE: This function generates OPTGROUP elements for subtrees. However, note that HTML5 specifies that OPTGROUP elemnents made not nest! This function generates the markup for them but they are not rendered by most browsers, or not completely. Therefore, for now, do not specify more than one level subtrees. Future versions of HTML may support it. I also plan to add here options to avoid OPTGROUPS entirely either by indenting option text, or by creating alternate DOM nodes using `<li>` instead of `<select>`, or both.
 * @memberOf popMenu
 *
 * @param {Element|string} el - Must be one of (case-sensitive):
 * * text box - an `HTMLInputElement` to use an existing element or `'INPUT'` to create a new one
 * * drop-down - an `HTMLSelectElement` to use an existing element or `'SELECT'` to create a new one
 * * submenu - an `HTMLOptGroupElement` to use an existing element or `'OPTGROUP'` to create a new one (meant for internal use only)
 *
 * @param {menuItem[]} [menu] - Hierarchical list of strings to add as `<option>...</option>` or `<optgroup>....</optgroup>` elements. Omitting creates a text box.
 *
 * @param {null|string} [options.prompt=''] - Adds an initial `<option>...</option>` element to the drop-down with this value in parentheses as its `text`; and empty string as its `value`. Default is empty string, which creates a blank prompt; `null` suppresses prompt altogether.
 *
 * @param {boolean} [options.sort] - Whether to alpha sort or not. If truthy, sorts each optgroup on its `label`; and each select option on its text (its `alias` if given; or its `name` if not).
 *
 * @param {string[]} [options.blacklist] - Optional list of menu item names to be ignored.
 *
 * @param {number[]} [options.breadcrumbs] - List of option group section numbers (root is section 0). (For internal use.)
 *
 * @param {boolean} [options.append=false] - When `el` is an existing `<select>` Element, giving truthy value adds the new children without first removing existing children.
 *
 * @returns {Element} Either a `<select>` or `<optgroup>` element.
 */
function build(el, menu, options) {
    options = options || {};

    var prompt = options.prompt,
        blacklist = options.blacklist,
        sort = options.sort,
        breadcrumbs = options.breadcrumbs || [],
        path = breadcrumbs.length ? breadcrumbs.join('.') + '.' : '',
        subtreeName = popMenu.subtree,
        groupIndex = 0,
        tagName;

    if (el instanceof Element) {
        tagName = el.tagName;
        if (!options.append) {
            el.innerHTML = ''; // remove all <option> and <optgroup> elements
        }
    } else {
        tagName = el;
        el = document.createElement(tagName);
    }

    if (menu) {
        var add, newOption;
        if (tagName === 'SELECT') {
            add = el.add;
            if (prompt) {
                newOption = new Option(prompt, '');
                newOption.innerHTML += '&hellip;';
                el.add(newOption);
            } else if (prompt !== null) {
                el.add(new Option());
            }
        } else {
            add = el.appendChild;
            el.label = prompt;
        }

        if (sort) {
            menu = menu.slice().sort(itemComparator); // sorted clone
        }

        menu.forEach(function(item) {
            // if item is of form a(b) and there is an function a in options, then item = options.a(b)
            if (options && typeof item === 'string') {
                var indirection = item.match(REGEXP_INDIRECTION);
                if (indirection) {
                    var a = indirection[1],
                        b = indirection[2],
                        f = options[a];
                    if (typeof f === 'function') {
                        item = f(b);
                    } else {
                        throw 'build: Expected options.' + a + ' to be a function.';
                    }
                }
            }

            var subtree = item[subtreeName] || item;
            if (subtree instanceof Array) {

                var groupOptions = {
                    breadcrumbs: breadcrumbs.concat(++groupIndex),
                    prompt: item.label || 'Group ' + path + groupIndex,
                    options: sort,
                    blacklist: blacklist
                };

                var optgroup = build('OPTGROUP', subtree, groupOptions);

                if (optgroup.childElementCount) {
                    el.appendChild(optgroup);
                }

            } else if (typeof item !== 'object') {

                if (!(blacklist && blacklist.indexOf(item) >= 0)) {
                    add.call(el, new Option(item));
                }

            } else if (!item.hidden) {

                var name = item.name || item.alias;
                if (!(blacklist && blacklist.indexOf(name) >= 0)) {
                    add.call(el, new Option(
                        item.alias || item.name,
                        name
                    ));
                }

            }
        });
    } else {
        el.type = 'text';
    }

    return el;
}

function itemComparator(a, b) {
    a = a.alias || a.name || a.label || a;
    b = b.alias || b.name || b.label || b;
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @summary Recursively searches the context array of `menuItem`s for a named `item`.
 * @memberOf popMenu
 * @this Array
 * @param {object} [options]
 * @param {string} [options.keys=[popMenu.defaultKey]] - Properties to search each menuItem when it is an object.
 * @param {boolean} [options.caseSensitive=false] - Ignore case while searching.
 * @param {string} value - Value to search for.
 * @returns {undefined|menuItem} The found item or `undefined` if not found.
 */
function lookup(options, value) {
    if (arguments.length === 1) {
        value = options;
        options = undefined;
    }

    var shallow, deep, item, prop,
        keys = options && options.keys || [popMenu.defaultKey],
        caseSensitive = options && options.caseSensitive;

    value = toString(value, caseSensitive);

    shallow = this.find(function(item) {
        var subtree = item[popMenu.subtree] || item;

        if (subtree instanceof Array) {
            return (deep = lookup.call(subtree, options, value));
        }

        if (typeof item !== 'object') {
            return toString(item, caseSensitive) === value;
        } else {
            for (var i = 0; i < keys.length; ++i) {
                prop = item[keys[i]];
                if (prop && toString(prop, caseSensitive) === value) {
                    return true;
                }
            }
        }
    });

    item = deep || shallow;

    return item && (item.name ? item : { name: item });
}

function toString(s, caseSensitive) {
    var result = '';
    if (s) {
        result += s; // convert s to string
        if (!caseSensitive) {
            result = result.toUpperCase();
        }
    }
    return result;
}

/**
 * @summary Recursively walks the context array of `menuItem`s and calls `iteratee` on each item therein.
 * @desc `iteratee` is called with each item (terminal node) in the menu tree and a flat 0-based index. Recurses on member with name of `popMenu.subtree`.
 *
 * The node will always be a {@link valueItem} object; when a `string`, it is boxed for you.
 *
 * @memberOf popMenu
 *
 * @this Array
 *
 * @param {function} iteratee - For each item in the menu, `iteratee` is called with:
 * * the `valueItem` (if the item is a primative string, it is wrapped up for you)
 * * a 0-based `ordinal`
 *
 * The `iteratee` return value can be used to replace the item, as follows:
 * * `undefined` - do nothing
 * * `null` - splice out the item; resulting empty submenus are also spliced out (see note)
 * * anything else - replace the item with this value; if value is a subtree (i.e., an array) `iteratee` will then be called to walk it as well (see note)
 *
 * > Note: Returning anything (other than `undefined`) from `iteratee` will (deeply) mutate the original `menu` so you may want to copy it first (deeply, including all levels of array nesting but not the terminal node objects).
 *
 * @returns {number} Number of items (terminal nodes) in the menu tree.
 */
function walk(iteratee) {
    var menu = this,
        ordinal = 0,
        subtreeName = popMenu.subtree,
        i, item, subtree, newVal;

    for (i = menu.length - 1; i >= 0; --i) {
        item = menu[i];
        subtree = item[subtreeName] || item;

        if (!(subtree instanceof Array)) {
            subtree = undefined;
        }

        if (!subtree) {
            newVal = iteratee(item.name ? item : { name: item }, ordinal);
            ordinal += 1;

            if (newVal !== undefined) {
                if (newVal === null) {
                    menu.splice(i, 1);
                    ordinal -= 1;
                } else {
                    menu[i] = item = newVal;
                    subtree = item[subtreeName] || item;
                    if (!(subtree instanceof Array)) {
                        subtree = undefined;
                    }
                }
            }
        }

        if (subtree) {
            ordinal += walk.call(subtree, iteratee);
            if (subtree.length === 0) {
                menu.splice(i, 1);
                ordinal -= 1;
            }
        }
    }

    return ordinal;
}

/**
 * @summary Format item name with it's alias when available.
 * @memberOf popMenu
 * @param {string|valueItem} item
 * @returns {string} The formatted name and alias.
 */
function formatItem(item) {
    var result = item.name || item;
    if (item.alias) {
        result = '"' + item.alias + '" (' + result + ')';
    }
    return result;
}


function isGroupProxy(s) {
    return REGEXP_INDIRECTION.test(s);
}

/**
 * @namespace
 */
var popMenu = {
    build: build,
    walk: walk,
    lookup: lookup,
    formatItem: formatItem,
    isGroupProxy: isGroupProxy,
    subtree: 'submenu',
    defaultKey: 'name'
};

module.exports = popMenu;

},{}],19:[function(require,module,exports){
// tabz node module
// https://github.com/joneit/tabz

/* eslint-env node, browser */

'use strict';

var cssInjector = require('css-injector');

/**
 * Register/deregister click handler on all tab collections.
 * @param {Element} [options.root=document] - Where to look for tab panels (`.tabz` elements) containing tabs and folders.
 * @param {boolean} [options.unhook=false] - Remove event listener from tab panels (`.tabz` elements).
 * @param {Element} [options.referenceElement] - Passed to cssInjector's insertBefore() call.
 * @param {string} [options.defaultTabSelector='.default-tab'] - .classname or #id of the tab to select by default
 * @param {object} [options.onEnable] - Handler implementation. See {@link Tabz#onEnable|onEnable}.
 * @param {object} [options.onDisable] - Handler implementation. See {@link Tabz#onDisable|onEnable}.
 * @param {object} [options.onEnabled] - Handler implementation. See {@link Tabz#onEnabled|onEnable}.
 * @param {object} [options.onDisabled] - Handler implementation. See {@link Tabz#onDisabled|onEnable}.
 * @constructor
 */
function Tabz(options) {
    var i, el;

    options = options || {};
    var root = options.root || document,
        unhook = options.unhook,
        referenceElement = options.referenceElement,
        defaultTabSelector = options.defaultTabSelector || '.default-tab';

    if (!unhook) {
        var css;
        /* inject:css */
        css = '.tabz{position:relative;visibility:hidden;height:100%}.tabz>header{position:relative;display:inline-block;background-color:#fff;margin-left:1em;padding:5px .6em;border:1px solid #666;border-bottom-color:transparent;border-radius:6px 6px 0 0;cursor:default;user-select:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none}.tabz>header+section{position:absolute;display:none;background-color:#fff;margin-top:-1px;padding:8px;border:1px solid #666;border-radius:6px;left:0;right:0;bottom:0;top:0;z-index:0}.tabz>header+section.tabz-enable{z-index:1}.tabz>header.tabz-enable{z-index:2}.tabz-bg0{background-color:#eee!important}.tabz-bg1{background-color:#eef!important}.tabz-bg2{background-color:#efe!important}.tabz-bg3{background-color:#eff!important}.tabz-bg4{background-color:#fee!important}.tabz-bg5{background-color:#fef!important}.tabz-bg6{background-color:#ffe!important}';
        /* endinject */

        if (!referenceElement) {
            // find first <link> or <style> in <head>
            var headStuff = document.querySelector('head').children;
            for (i = 0; !referenceElement && i < headStuff.length; ++i) {
                el = headStuff[i];
                if (el.tagName === 'STYLE' || el.tagName === 'LINK' && el.rel === 'stylesheet') {
                    referenceElement = el;
                }
            }
        }
        cssInjector(css, 'tabz-css-base', referenceElement);

        for (var key in options) {
            if (this[key] === noop) {
                this[key] = options[key];
            }
        }

        /**
         * @summary The context of this tab object.
         * @desc The context may encompass any number of tab panels (`.tabz` elements).
         * @type {HTMLDocumen|HTMLElement}
         */
        this.root = root;

        // enable first tab on each tab panel (`.tabz` element)
        forEachEl('.tabz>header:first-of-type,.tabz>section:first-of-type', function(el) {
            el.classList.add('tabz-enable');
        }, root);

        // enable default tab and all its parents (must be a tab)
        this.tabTo(root.querySelector('.tabz > header' + defaultTabSelector));

        setTimeout(function() {
            forEachEl('.tabz > section', function(el) {

                // Step 1: A bug in older versions of Chrome (like v40) that inserted a break at mark-up location of an absolute positioned block. The work-around is to hide those blocks until after first render; then show them. I don't know why this works but it does. Seems to be durable.
                el.style.display = 'block';

                // Step 2: Adjust absolute top of each rendered folder to the bottom of its tab
                el.style.top = el.previousElementSibling.getBoundingClientRect().bottom - el.parentElement.getBoundingClientRect().top + 'px';

            }, root);
        }, 0);
    }

    var method = unhook ? 'removeEventListener' : 'addEventListener';
    var boundClickHandler = onclick.bind(this);
    forEachEl('.tabz', function(tabBar) {
        tabBar.style.visibility = 'visible';
        tabBar[method]('click', boundClickHandler);
    }, root);
}

function onclick(evt) {
    click.call(this, evt.currentTarget, evt.target);
}

/**
 * @summary Selects the given tab.
 * @desc If it is a nested tab, also reveals all its ancestor tabs.
 * @param {string|HTMLElement} [el] - May be one of:
 * * `HTMLElement`
 *   * `<header>` - tab element
 *   * `<section>` - folder element
 * * `string` - CSS selector to one of the above
 * * falsy - fails silently
 * @memberOf Tabz.prototype
 */
Tabz.prototype.tabTo = function(el) {
    while ((el = this.tab(el))) {
        click.call(this, el.parentElement, el);
        el = el.parentElement.parentElement; // loop to click on each containing tab...
    }
};

/**
 * Current selected tab.
 * @param {HTMLElement|number} el - An element that is (or is within) the tab panel (`.tabz` element) to look in.
 * @returns {undefined|HTMLElement} Returns tab (`<header>`) element.  Returns `undefined` if `el` is neither of the above or an out of range index.
 */
Tabz.prototype.enabledTab = function(el) {
    el = this.panel(el);
    return el && el.querySelector(':scope>header.tabz-enable');
};

/**
 * @summary Get tab element.
 * @desc Get tab element if given tab or folder element; or an element within such; or find tab.
 * @param {string|Element} [el] - May be one of:
 * * a tab (a `<header>` element)
 * * a folder (a `<section>` element)
 * * an element within one of the above
 * * `string` - CSS selector to one of the above, searching within the root or document
 * @returns {null|Element} tab (`<header>...</header>`) element or `null` if not found
 * @memberOf Tabz.prototype
 */
Tabz.prototype.tab = function(el) {
    el = lookForEl.call(this, el);
    return !(el instanceof HTMLElement) ? null : el.tagName === 'HEADER' ? el : el.tagName === 'SECTION' ? el.previousElementSibling : null;
};

/**
 * @summary Get folder element.
 * @desc Get folder element if given tab or folder element; or an element within such; or find folder.
 * @param {string|Element} [el] - May be one of:
 * * a tab (a `<header>` element)
 * * a folder (a `<section>` element)
 * * an element within one of the above
 * * `string` - CSS selector to one of the above, searching within the root or document
 * @returns {null|Element} tab (`<header>...</header>`) element or `null` if not found
 * @memberOf Tabz.prototype
 */
Tabz.prototype.folder = function(el) {
    el = lookForEl.call(this, el);
    return !(el instanceof HTMLElement) ? null : el.tagName === 'SECTION' ? el : el.tagName === 'HEADER' ? el.nextElementSibling : null;
};

/**
 * @summary Get tab panel element.
 * @desc Get panel element if given tab panel element; or an element within a tab panel; or find tab panel.
 * @param {string|Element} [el] - May be one of:
 * * a tab panel (an `HTMLElement` with class `tabz`)
 * * an element within a tab panel
 * * `string` - CSS selector to one a tab panel, searching within the root or document
 * @returns {null|Element} tab panel element or `null` if not found
 * @memberOf Tabz.prototype
 */
Tabz.prototype.panel = function(el) {
    while (el && !el.classList.contains('tabz')) {
        el = el.parentElement;
    }
    return !(el instanceof HTMLElement) ? null : el.classList.contains('tabz') ? el : null;
};

function lookForEl(el) {
    if (el instanceof Element) {
        while (el && el.tagName !== 'HEADER' && el.tagName !== 'SECTION') {
            el = el.parentElement;
        }
    } else {
        el = this.root.querySelector(el);
    }
    return el;
}

/** Enables the tab/folder pair of the clicked tab.
 * Disables all the other pairs in this scope which will include the previously enabled pair.
 * @private
 * @this Tabz
 * @param {Element} div - The tab panel (`.tabz` element) that's handling the click event.
 * @param {Element} target - The element that received the click.
 * @returns {undefined|Element} The `<header>` element (tab) the was clicked; or `undefined` when click was not within a tab.
 */
function click(div, target) {
    var newTab, oldTab;

    forEachEl(':scope>header:not(.tabz-enable)', function(tab) { // todo: use a .find() polyfill here
        if (tab.contains(target)) {
            newTab = tab;
        }
    }, div);

    if (newTab) {
        oldTab = this.enabledTab(div);
        toggleTab.call(this, oldTab, false);
        toggleTab.call(this, newTab, true);
    }

    return newTab;
}

/**
 * @private
 * @this Tabz
 * @param {Element} tab - The `<header>` element of the tab to enable or disable.
 * @param {boolean} enable - Enable (vs. disable) the tab.
 */
function toggleTab(tab, enable) {
    if (tab) {
        var folder = this.folder(tab),
            method = enable ? 'onEnable' : 'onDisable';

        this[method].call(this, tab, folder);

        tab.classList.toggle('tabz-enable', enable);
        folder.classList.toggle('tabz-enable', enable);

        method += 'd';
        this[method].call(this, tab, folder);
    }
}

/**
 * @typedef tabEvent
 * @type {function}
 * @param {tabEventObject}
 */

/**
 * @typedef tabEventObject
 * @property {Tabz} tabz - The tab object issuing the callback.
 * @property {Element} target - The tab (`<header>` element).
 */

/**
 * Called before a previously disabled tab is enabled.
 * @type {tabEvent}
 * @abstract
 * @memberOf Tabz.prototype
 */
Tabz.prototype.onEnable = noop;

/**
 * Called before a previously enabled tab is disabled by another tab being enabled.
 * @type {tabEvent}
 * @abstract
 * @memberOf Tabz.prototype
 */
Tabz.prototype.onDisable = noop;

/**
 * Called after a previously disabled tab is enabled.
 * @type {tabEvent}
 * @abstract
 * @memberOf Tabz.prototype
 */
Tabz.prototype.onEnabled = noop;

/**
 * Called after a previously enabled tab is disabled by another tab being enabled.
 * @type {tabEvent}
 * @abstract
 * @memberOf Tabz.prototype
 */
Tabz.prototype.onDisabled = noop;

function noop() {} // null pattern

function forEachEl(selector, iteratee, context) {
    return Array.prototype.forEach.call((context || document).querySelectorAll(selector), iteratee);
}


module.exports = Tabz;

},{"css-injector":13}],20:[function(require,module,exports){
// templex node module
// https://github.com/joneit/templex

/* eslint-env node */

/**
 * Merges values of execution context properties named in template by {prop1},
 * {prop2}, etc., or any javascript expression incorporating such prop names.
 * The context always includes the global object. In addition you can specify a single
 * context or an array of contexts to search (in the order given) before finally
 * searching the global context.
 *
 * Merge expressions consisting of simple numeric terms, such as {0}, {1}, etc., deref
 * the first context given, which is assumed to be an array. As a convenience feature,
 * if additional args are given after `template`, `arguments` is unshifted onto the context
 * array, thus making first additional arg available as {1}, second as {2}, etc., as in
 * `templex('Hello, {1}!', 'World')`. ({0} is the template so consider this to be 1-based.)
 *
 * If you prefer something other than braces, redefine `templex.regexp`.
 *
 * See tests for examples.
 *
 * @param {string} template
 * @param {...string} [args]
 */
function templex(template) {
    var contexts = this instanceof Array ? this : [this];
    if (arguments.length > 1) { contexts.unshift(arguments); }
    return template.replace(templex.regexp, templex.merger.bind(contexts));
}

templex.regexp = /\{(.*?)\}/g;

templex.with = function (i, s) {
    return 'with(this[' + i + ']){' + s + '}';
};

templex.cache = [];

templex.deref = function (key) {
    if (!(this.length in templex.cache)) {
        var code = 'return eval(expr)';

        for (var i = 0; i < this.length; ++i) {
            code = templex.with(i, code);
        }

        templex.cache[this.length] = eval('(function(expr){' + code + '})'); // eslint-disable-line no-eval
    }
    return templex.cache[this.length].call(this, key);
};

templex.merger = function (match, key) {
    // Advanced features: Context can be a list of contexts which are searched in order.
    var replacement;

    try {
        replacement = isNaN(key) ? templex.deref.call(this, key) : this[0][key];
    } catch (e) {
        replacement = '{' + key + '}';
    }

    return replacement;
};

// this interface consists solely of the templex function (and it's properties)
module.exports = templex;

},{}]},{},[7])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2RpYWxvZy11aS9jc3MvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2RpYWxvZy11aS9kaWFsb2dzL0NvbHVtblBpY2tlci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvZGlhbG9nLXVpL2RpYWxvZ3MvRGlhbG9nLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9kaWFsb2ctdWkvZGlhbG9ncy9NYW5hZ2VGaWx0ZXJzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9kaWFsb2ctdWkvZGlhbG9ncy9jb3B5LWlucHV0LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9kaWFsb2ctdWkvZGlhbG9ncy9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvZGlhbG9nLXVpL2Zha2VfOGFhNGFiYTAuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2RpYWxvZy11aS9odG1sL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9kaWFsb2ctdWkvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvZGlhbG9nLXVpL21peC1pbnMvZGVmYXVsdHMuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2RpYWxvZy11aS9taXgtaW5zL2dyaWQuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvYXV0b21hdC9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9jc3MtaW5qZWN0b3IvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvaW5qZWN0LXN0eWxlc2hlZXQtdGVtcGxhdGUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvbGlzdC1kcmFnb24vaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvb2JqZWN0LWl0ZXJhdG9ycy9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9vdmVycmlkZXIvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvcG9wLW1lbnUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvdGFiei9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy90ZW1wbGV4L2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ROQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHNbJ2xpc3QtZHJhZ29uLWFkZGVuZHVtJ10gPSBbXG4nZGl2LmRyYWdvbi1saXN0LCBsaS5kcmFnb24tcG9wIHsnLFxuJ1x0Zm9udC1mYW1pbHk6IFJvYm90bywgc2Fucy1zZXJpZjsnLFxuJ1x0dGV4dC10cmFuc2Zvcm06IGNhcGl0YWxpemU7IH0nLFxuJ2Rpdi5kcmFnb24tbGlzdCB7JyxcbidcdHBvc2l0aW9uOiBhYnNvbHV0ZTsnLFxuJ1x0dG9wOiA0JTsnLFxuJ1x0bGVmdDogNCU7JyxcbidcdGhlaWdodDogOTIlOycsXG4nXHR3aWR0aDogMjAlOyB9JyxcbidkaXYuZHJhZ29uLWxpc3Q6bnRoLWNoaWxkKDIpIHsgbGVmdDogMjglOyB9JyxcbidkaXYuZHJhZ29uLWxpc3Q6bnRoLWNoaWxkKDMpIHsgbGVmdDogNTIlOyB9JyxcbidkaXYuZHJhZ29uLWxpc3Q6bnRoLWNoaWxkKDQpIHsgbGVmdDogNzYlOyB9JyxcbidkaXYuZHJhZ29uLWxpc3QgPiBkaXYsIGRpdi5kcmFnb24tbGlzdCA+IHVsID4gbGksIGxpLmRyYWdvbi1wb3AgeyBsaW5lLWhlaWdodDogNDZweDsgfScsXG4nZGl2LmRyYWdvbi1saXN0ID4gdWwgeyB0b3A6IDQ2cHg7IH0nLFxuJ2Rpdi5kcmFnb24tbGlzdCA+IHVsID4gbGk6bm90KDpsYXN0LWNoaWxkKTo6YmVmb3JlLCBsaS5kcmFnb24tcG9wOjpiZWZvcmUgeycsXG4nXHRjb250ZW50OiBcXCdcXFxcMmIyNFxcJzsnLFxuJ1x0Y29sb3I6ICNiNmI2YjY7JyxcbidcdGZvbnQtc2l6ZTogMzBweDsnLFxuJ1x0bWFyZ2luOiA4cHggMTRweCA4cHggOHB4OyB9JyxcbidsaS5kcmFnb24tcG9wIHsgb3BhY2l0eTouODsgfSdcbl0uam9pbignXFxuJyk7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgTGlzdERyYWdvbiA9IHJlcXVpcmUoJ2xpc3QtZHJhZ29uJyk7XG52YXIgaW5qZWN0Q1NTID0gcmVxdWlyZSgnaW5qZWN0LXN0eWxlc2hlZXQtdGVtcGxhdGUnKS5iaW5kKHJlcXVpcmUoJy4uL2NzcycpKTtcblxudmFyIERpYWxvZyA9IHJlcXVpcmUoJy4vRGlhbG9nJyk7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAZXh0ZW5kcyBEaWFsb2dcbiAqL1xudmFyIENvbHVtblBpY2tlciA9IERpYWxvZy5leHRlbmQoJ0NvbHVtblBpY2tlcicsIHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBNYXkgaW5jbHVkZSBgRGlhbG9nYCBvcHRpb25zLlxuICAgICAqL1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKGdyaWQsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGJlaGF2aW9yID0gZ3JpZC5iZWhhdmlvcjtcblxuICAgICAgICB0aGlzLmdyaWQgPSBncmlkO1xuXG4gICAgICAgIGlmIChiZWhhdmlvci5pc0NvbHVtblJlb3JkZXJhYmxlKCkpIHtcbiAgICAgICAgICAgIC8vIHBhcnNlICYgYWRkIHRoZSBkcmFnLWFuZC1kcm9wIHN0eWxlc2hlZXQgYWRkZW5kdW1cbiAgICAgICAgICAgIHZhciBzdHlsZXNoZWV0QWRkZW5kdW0gPSBpbmplY3RDU1MoJ2xpc3QtZHJhZ29uLWFkZGVuZHVtJyk7XG5cbiAgICAgICAgICAgIC8vIGdyYWIgdGhlIGdyb3VwIGxpc3RzIGZyb20gdGhlIGJlaGF2aW9yXG4gICAgICAgICAgICBpZiAoYmVoYXZpb3Iuc2V0R3JvdXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEdyb3VwcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdHcm91cHMnLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbHM6IGJlaGF2aW9yLmdldEdyb3VwcygpXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlR3JvdXBzID0ge1xuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ0F2YWlsYWJsZSBHcm91cHMnLFxuICAgICAgICAgICAgICAgICAgICBtb2RlbHM6IGJlaGF2aW9yLmdldEF2YWlsYWJsZUdyb3VwcygpXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHZhciBncm91cFBpY2tlciA9IG5ldyBMaXN0RHJhZ29uKFtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEdyb3VwcyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVHcm91cHNcbiAgICAgICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgZHJhZy1hbmQtZHJvcCBzZXRzIHRvIHRoZSBkaWFsb2dcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZChncm91cFBpY2tlci5tb2RlbExpc3RzWzBdLmNvbnRhaW5lcik7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmQoZ3JvdXBQaWNrZXIubW9kZWxMaXN0c1sxXS5jb250YWluZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBncmFiIHRoZSBjb2x1bW4gbGlzdHMgZnJvbSB0aGUgYmVoYXZpb3JcbiAgICAgICAgICAgIHRoaXMuaW5hY3RpdmVDb2x1bW5zID0ge1xuICAgICAgICAgICAgICAgIHRpdGxlOiAnSW5hY3RpdmUgQ29sdW1ucycsXG4gICAgICAgICAgICAgICAgbW9kZWxzOiBiZWhhdmlvci5nZXRIaWRkZW5Db2x1bW5zKCkuc29ydChjb21wYXJlQnlOYW1lKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5hY3RpdmVDb2x1bW5zID0ge1xuICAgICAgICAgICAgICAgIHRpdGxlOiAnQWN0aXZlIENvbHVtbnMnLFxuICAgICAgICAgICAgICAgIG1vZGVsczogZ3JpZC5nZXRBY3RpdmVDb2x1bW5zKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMuc29ydE9uSGlkZGVuQ29sdW1ucyA9IHRoaXMud2FzU29ydE9uSGlkZGVuQ29sdW1ucyA9IHRydWU7XG5cbiAgICAgICAgICAgIHZhciBjb2x1bW5QaWNrZXIgPSBuZXcgTGlzdERyYWdvbihbXG4gICAgICAgICAgICAgICAgdGhpcy5pbmFjdGl2ZUNvbHVtbnMsXG4gICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVDb2x1bW5zXG4gICAgICAgICAgICBdLCB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaXN0LWRyYWdvbi1iYXNlIHN0eWxlc2hlZXQgcmlnaHQgYmVmb3JlIHRoZSBhZGRlbmR1bVxuICAgICAgICAgICAgICAgIGNzc1N0eWxlc2hlZXRSZWZlcmVuY2VFbGVtZW50OiBzdHlsZXNoZWV0QWRkZW5kdW0sXG4gICAgICAgICAgICAgICAgLy8gdGhlc2UgbW9kZWxzIGhhdmUgYSBoZWFkZXIgcHJvcGVydHkgYXMgdGhlaXIgbGFiZWxzXG4gICAgICAgICAgICAgICAgbGFiZWw6ICd7aGVhZGVyfSdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGRyYWctYW5kLWRyb3Agc2V0cyB0byB0aGUgZGlhbG9nXG4gICAgICAgICAgICB0aGlzLmFwcGVuZChjb2x1bW5QaWNrZXIubW9kZWxMaXN0c1swXS5jb250YWluZXIpO1xuICAgICAgICAgICAgdGhpcy5hcHBlbmQoY29sdW1uUGlja2VyLm1vZGVsTGlzdHNbMV0uY29udGFpbmVyKTtcblxuICAgICAgICAgICAgLy9MaXN0ZW4gdG8gdGhlIHZpc2libGUgY29sdW1uIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbHVtblBpY2tlci5tb2RlbExpc3RzWzFdLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbGlzdGNoYW5nZWQnLCBmdW5jdGlvbihlKXtcbiAgICAgICAgICAgICAgICBncmlkLmZpcmVTeW50aGV0aWNPbkNvbHVtbnNDaGFuZ2VkRXZlbnQoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLnNvcnRPbkhpZGRlbkNvbHVtbnMgPSB0aGlzLmdyaWQucHJvcGVydGllcy5zb3J0T25IaWRkZW5Db2x1bW5zO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgZGl2LnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgICAgICAgZGl2LnN0eWxlLm1hcmdpblRvcCA9ICcyZW0nO1xuICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9ICdUaGUgc2VsZWN0aW9uIG9mIHZpc2libGUgY29sdW1ucyBpbiB0aGUgZ3JpZCBtYXkgbm90IGJlIGNoYW5nZWQuJztcbiAgICAgICAgICAgIHRoaXMuYXBwZW5kKGRpdik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgY2hlY2tib3ggdG8gY29udHJvbCBwYW5lbCBmb3Igc29ydGluZyBvbiBoaWRkZW4gZmllbGRzXG4gICAgICAgIHZhciBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgICAgIGxhYmVsLmlubmVySFRNTCA9ICc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCI+IEFsbG93IHNvcnRpbmcgb24gaGlkZGVuIGNvbHVtbnMnO1xuICAgICAgICBsYWJlbC5zdHlsZS5mb250V2VpZ2h0ID0gJ25vcm1hbCc7XG4gICAgICAgIGxhYmVsLnN0eWxlLm1hcmdpblJpZ2h0ID0gJzJlbSc7XG5cbiAgICAgICAgdmFyIGNoZWNrYm94ID0gbGFiZWwucXVlcnlTZWxlY3RvcignaW5wdXQnKTtcbiAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHRoaXMuc29ydE9uSGlkZGVuQ29sdW1ucztcbiAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihlKXtcbiAgICAgICAgICAgIHNlbGYuc29ydE9uSGlkZGVuQ29sdW1ucyA9IGNoZWNrYm94LmNoZWNrZWQ7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgcGFuZWwgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3IoJy5oeXBlcmdyaWQtZGlhbG9nLWNvbnRyb2wtcGFuZWwnKTtcbiAgICAgICAgcGFuZWwuaW5zZXJ0QmVmb3JlKGxhYmVsLCBwYW5lbC5maXJzdENoaWxkKTtcblxuICAgICAgICAvLyBhZGQgdGhlIGRpYWxvZyB0byB0aGUgRE9NXG4gICAgICAgIHRoaXMub3BlbihvcHRpb25zLmNvbnRhaW5lcik7XG4gICAgfSxcblxuICAgIG9uQ2xvc2VkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGJlaGF2aW9yID0gdGhpcy5ncmlkLmJlaGF2aW9yLFxuICAgICAgICAgICAgY29sdW1ucyA9IGJlaGF2aW9yLmdldEFjdGl2ZUNvbHVtbnMoKTtcblxuICAgICAgICBpZiAodGhpcy5hY3RpdmVDb2x1bW5zKSB7XG4gICAgICAgICAgICB2YXIgdHJlZSA9IGNvbHVtbnNbMF07XG5cbiAgICAgICAgICAgIC8vIFRPRE86IGJyZWFraW5nIGVuY2Fwc3VsYXRpb247IHNob3VsZCBiZSB1c2luZyBzZXR0ZXJzIGFuZCBnZXR0ZXJzIG9uIHRoZSBiZWhhdmlvclxuICAgICAgICAgICAgY29sdW1ucy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgaWYgKHRyZWUgJiYgdHJlZS5sYWJlbCA9PT0gJ1RyZWUnKSB7XG4gICAgICAgICAgICAgICAgY29sdW1ucy5wdXNoKHRyZWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hY3RpdmVDb2x1bW5zLm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uKGNvbHVtbikge1xuICAgICAgICAgICAgICAgIGNvbHVtbnMucHVzaChjb2x1bW4pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNvcnRPbkhpZGRlbkNvbHVtbnMgIT09IHRoaXMud2FzU29ydE9uSGlkZGVuQ29sdW1ucykge1xuICAgICAgICAgICAgICAgIGJlaGF2aW9yLnNvcnRDaGFuZ2VkKHRoaXMuaW5hY3RpdmVDb2x1bW5zLm1vZGVscyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJlaGF2aW9yLmNoYW5nZWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNlbGVjdGVkR3JvdXBzKXtcbiAgICAgICAgICAgIHZhciBncm91cEJ5cyA9IHRoaXMuc2VsZWN0ZWRHcm91cHMubW9kZWxzLm1hcChmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGUuaWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJlaGF2aW9yLnNldEdyb3Vwcyhncm91cEJ5cyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdyaWQudGFrZUZvY3VzKCk7XG4gICAgICAgIHRoaXMuZ3JpZC5hbGxvd0V2ZW50cyh0cnVlKTtcbiAgICB9XG59KTtcblxuZnVuY3Rpb24gY29tcGFyZUJ5TmFtZShhLCBiKSB7XG4gICAgYSA9IGEuaGVhZGVyLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKTtcbiAgICBiID0gYi5oZWFkZXIudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpO1xuICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyArMSA6IDA7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb2x1bW5QaWNrZXI7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXV0b21hdCA9IHJlcXVpcmUoJ2F1dG9tYXQnKTtcbnZhciBtYXJrdXAgPSByZXF1aXJlKCcuLi9odG1sJyk7XG5cbnZhciBCYXNlID0gd2luZG93LmZpbi5IeXBlcmdyaWQuQmFzZTsgLy8gdHJ5IHJlcXVpcmUoJ2Zpbi1oeXBlcmdyaWQvc3JjL0Jhc2UnKSB3aGVuIGV4dGVybmFsaXplZFxuXG4vKipcbiAqIENyZWF0ZXMgYW5kIHNlcnZpY2VzIGEgRE9NIGVsZW1lbnQgdXNlZCBhcyBhIGNudGFpbmVyIGZvciBhIGRpYWxvZy4gVGhlIHN0YW5kYXJkIGBtYXJrdXAuZGlhbG9nYCBpcyBzaW1wbHkgYSBkaXYgd2l0aCBhIF9jb250cm9sIHBhbmVsXyBjb250YWluaW5nIGEgY2xvc2UgYm94IGFuZCBhIHNldHRpbmdzIGdlYXIgaWNvbi5cbiAqXG4gKiBZb3UgY2FuIHN1cHBseSBhbiBhbHRlcm5hdGl2ZSBkaWFsb2cgdGVtcGxhdGUuIFRoZSBpbnRlcmZhY2UgaXM6XG4gKiAqIENsYXNzIG5hbWUgYGh5cGVyZ3JpZC1kaWFsb2dgLlxuICogKiBBdCBsZWFzdCBvbmUgY2hpbGQgZWxlbWVudC4gQ29udGVudCB3aWxsIGJlIGluc2VydGVkIGJlZm9yZSB0aGlzIGZpcnN0IGNoaWxkLlxuICogKiBUeXBpY2FsbHkgY29udGFpbnMgYSBjbG9zZS1ib3ggZWxlbWVudCB3aXRoIGNsYXNzIG5hbWUgYGh5cGVyZ3JpZC1kaWFsb2ctY2xvc2VgIGFuZCBwb3NzaWJseSBvdGhlciBjb250cm9scyB3aXRoIGNsYXNzIG5hbWUgYGh5cGVyZ3JpZC1kaWFsb2cteHh4eGAgKHdoZXJlIF94eHh4XyBpcyBhIHVuaXF1ZSBuYW1lIGZvciB5b3VyIGNvbnRyb2wpLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgRGlhbG9nID0gQmFzZS5leHRlbmQoJ0RpYWxvZycsIHtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBiYXNpYyBkaWFsb2cgYm94IGluIGB0aGlzLmVsYC5cbiAgICAgKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc11cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xmdW5jdGlvbn0gW29wdGlvbnMuZGlhbG9nVGVtcGxhdGVdIC0gQW4gYWx0ZXJuYXRlIGRpYWxvZyB0ZW1wbGF0ZS4gVGhlIGxhc3QgY2hpbGQgZWxlbWVudCBtdXN0IGJlIHRoZSBcImNvbnRyb2wgcGFuZWwuXCJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnNldHRpbmdzPXRydWVdIC0gQ29udHJvbCBib3ggaGFzIHNldHRpbmdzIGljb24uIChTZXR0aW5ncyBpY29uIG11c3QgYmUgaW5jbHVkZWQgaW4gdGVtcGxhdGUuIFRoaXMgb3B0aW9uIHJlbW92ZXMgaXQuIFRoYXQgaXMsIGlmIGV4cGxpY2l0bHkgYGZhbHNlYCBfYW5kXyB0aGVyZSBpcyBhIHNldHRpbmdzIGNvbnRyb2wsIHJlbW92ZSBpdC4pXG4gICAgICogQHBhcmFtIHtzdHJpbmd8Ym9vbGVhbn0gW29wdGlvbnMuYmFja2dyb3VuZEltYWdlPWltYWdlcy5kaWFsb2cuc3JjXSAtIEEgVVJJIGZvciBhIGJhY2tncm91bmQgaW1hZ2UuIElmIGV4cGxpY2l0bHkgYGZhbHNlYCwgYmFja2dyb3VuZCBpbWFnZSBpcyBzdXBwcmVzc2VkLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IFt0ZXJtaW5hdGVdXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24oZ3JpZCwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICB0aGlzLmdyaWQgPSBncmlkO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgYmFja2Ryb3A7IGl0IGlzIGFic29sdXRlLXBvc2l0aW9uZWQgYW5kIHN0cmV0Y2hlZFxuICAgICAgICB0aGlzLmVsID0gYXV0b21hdC5maXJzdENoaWxkKG9wdGlvbnMuZGlhbG9nVGVtcGxhdGUgfHwgbWFya3VwLmRpYWxvZywgb3B0aW9ucy5kaWFsb2dSZXBsYWNlbWVudHMpO1xuXG4gICAgICAgIHRoaXMub3JpZ2luYWxGaXJzdENoaWxkID0gdGhpcy5lbC5maXJzdEVsZW1lbnRDaGlsZDtcblxuICAgICAgICBpZiAob3B0aW9ucy5zZXR0aW5ncyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHZhciBzZXR0aW5ncyA9IHRoaXMuZWwucXVlcnlTZWxlY3RvcignLmh5cGVyZ3JpZC1kaWFsb2ctc2V0dGluZ3MnKTtcbiAgICAgICAgICAgIGlmIChzZXR0aW5ncykge1xuICAgICAgICAgICAgICAgIHNldHRpbmdzLnJlbW92ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IGFsdGVybmF0aXZlIGJhY2tncm91bmQgaW1hZ2VcbiAgICAgICAgaWYgKG9wdGlvbnMuYmFja2dyb3VuZEltYWdlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgdGhpcy5lbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuYmFja2dyb3VuZEltYWdlKSB7XG4gICAgICAgICAgICB0aGlzLmVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICd1cmwoXFwnJyArIG9wdGlvbnMuYmFja2dyb3VuZEltYWdlICsgJ1xcJyknO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbGlzdGVuIGZvciBjbGlja3NcbiAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uQ2xpY2suYmluZCh0aGlzKSk7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudGVybWluYXRlKSB7XG4gICAgICAgICAgICB0aGlzLnRlcm1pbmF0ZSA9IG9wdGlvbnMudGVybWluYXRlO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEFkZHMgRE9NIGBOb2RlYHMgdG8gZGlhbG9nLlxuICAgICAqIEBkZXNjIElucHV0IGNhbiBiZSBub2RlcyBvciBhIHRlbXBsYXRlIGZyb20gd2hpY2ggdG8gY3JlYXRlIG5vZGVzLiBUaGUgbm9kZXMgYXJlIGluc2VydGVkIGludG8gdGhlIGRpYWxvZydzIERPTSAoYHRoaXMuZWxgKSwgcmlnaHQgYmVmb3JlIHRoZSBcImNvbnRyb2wgcGFuZWwuXCJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xmdW5jdGlvbnxOb2RlfE5vZGVbXX0gbm9kZXMgLSBTZWUgYGF1dG9tYXRgLlxuICAgICAqIEBwYXJhbSB7Li4uKn0gW3JlcGxhY2VtZW50c10gLSBTZWUgYGF1dG9tYXRgLlxuICAgICAqL1xuICAgIGFwcGVuZDogZnVuY3Rpb24obm9kZXMsIHJlcGxhY2VtZW50cy8qLi4uKi8pIHtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlcyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG5vZGVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBhcmdzLnNwbGljZSgxLCAwLCB0aGlzLmVsLCB0aGlzLm9yaWdpbmFsRmlyc3RDaGlsZCk7XG4gICAgICAgICAgICBhdXRvbWF0LmFwcGVuZC5hcHBseShudWxsLCBhcmdzKTtcblxuICAgICAgICB9IGVsc2UgaWYgKCdsZW5ndGgnIGluIG5vZGVzKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMub3JpZ2luYWxGaXJzdENoaWxkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbC5pbnNlcnRCZWZvcmUobm9kZXMsIHRoaXMub3JpZ2luYWxGaXJzdENoaWxkKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgZGlhbG9nIGludG8gRE9NLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW2NvbnRhaW5lcl0gLSBJZiB1bmRlZmluZWQsIGRpYWxvZyBpcyBhcHBlbmRlZCB0byBib2R5LlxuICAgICAqXG4gICAgICogSWYgZGVmaW5lZCwgZGlhbG9nIGlzIGFwcGVuZGVkIHRvIGNvbnRhaW5lci4gV2hlbiBjb250YWluZXIgaXMgbm90IGJvZHksIGl0IHdpbGwgYmU6XG4gICAgICogMC4gbWFkZSB2aXNpYmxlIGJlZm9yZSBhcHBlbmQgKGl0IHNob3VsZCBpbml0aWFsbHkgYmUgaGlkZGVuKVxuICAgICAqIDAuIG1hZGUgaGlkZGVuIGFmdGVyIHJlbW92ZVxuICAgICAqL1xuICAgIG9wZW46IGZ1bmN0aW9uKGNvbnRhaW5lcikge1xuICAgICAgICB2YXIgZXJyb3I7XG5cbiAgICAgICAgaWYgKCEodGhpcy5vcGVuZWQgfHwgdGhpcy5vcGVuaW5nIHx8IHRoaXMuY2xvc2VkIHx8IHRoaXMuY2xvc2luZykpIHtcbiAgICAgICAgICAgIGVycm9yID0gdGhpcy5vbk9wZW4oKTtcblxuICAgICAgICAgICAgaWYgKCFlcnJvcikge1xuICAgICAgICAgICAgICAgIHZhciBlbCA9IHRoaXMuZWw7XG5cbiAgICAgICAgICAgICAgICB0aGlzLm9wZW5pbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gY29udGFpbmVyIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2JvZHknKTtcblxuICAgICAgICAgICAgICAgIGlmIChjb250YWluZXIudGFnTmFtZSAhPT0gJ0JPRFknKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGluc2VydCB0aGUgbmV3IGRpYWxvZyBtYXJrdXAgaW50byB0aGUgRE9NXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGVsKTtcblxuICAgICAgICAgICAgICAgIC8vIHNjaGVkdWxlIGl0IGZvciBhIHNob3cgdHJhbnNpdGlvblxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGVsLmNsYXNzTGlzdC5hZGQoJ2h5cGVyZ3JpZC1kaWFsb2ctdmlzaWJsZScpOyB9LCA1MCk7XG5cbiAgICAgICAgICAgICAgICAvLyBhdCBlbmQgb2Ygc2hvdyB0cmFuc2l0aW9uLCBoaWRlIGFsbCB0aGUgaHlwZXJncmlkcyBiZWhpbmQgaXQgdG8gcHJldmVudCBhbnkga2V5L21vdXNlIGV2ZW50cyBmcm9tIGdldHRpbmcgdG8gdGhlbVxuICAgICAgICAgICAgICAgIC8vIHRvZG86IHBhdXNlIGFsbCBoeXBlcmdyaWRzIHNvIHRoZXkgZG9uJ3Qgc3BpbiB1c2VsZXNzbHlcbiAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJywgdGhpcy5oaWRlQXBwQm91bmQgPSBoaWRlQXBwLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZGlhbG9nIGZyb20gRE9NLlxuICAgICAqL1xuICAgIGNsb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGVycm9yO1xuXG4gICAgICAgIGlmICh0aGlzLm9wZW5lZCAmJiAhKHRoaXMuY2xvc2VkIHx8IHRoaXMuY2xvc2luZykpIHtcbiAgICAgICAgICAgIGVycm9yID0gdGhpcy5vbkNsb3NlKCk7XG5cbiAgICAgICAgICAgIGlmICghZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsb3NpbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8gdW5oaWRlIGFsbCB0aGUgaHlwZXJncmlkcyBiZWhpbmQgdGhlIGRpYWxvZ1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwVmlzaWJsZSgndmlzaWJsZScpO1xuXG4gICAgICAgICAgICAgICAgLy8gc3RhcnQgYSBoaWRlIHRyYW5zaXRpb24gb2YgZGlhbG9nIHJldmVhbGluZyBncmlkcyBiZWhpbmQgaXRcbiAgICAgICAgICAgICAgICB0aGlzLmVsLmNsYXNzTGlzdC5yZW1vdmUoJ2h5cGVyZ3JpZC1kaWFsb2ctdmlzaWJsZScpO1xuXG4gICAgICAgICAgICAgICAgLy8gYXQgZW5kIG9mIGhpZGUgdHJhbnNpdGlvbiwgcmVtb3ZlIGRpYWxvZyBmcm9tIHRoZSBET01cbiAgICAgICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCB0aGlzLnJlbW92ZURpYWxvZ0JvdW5kID0gcmVtb3ZlRGlhbG9nLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH0sXG5cbiAgICBhcHBTZWxlY3RvcjogJ2NhbnZhcy5oeXBlcmdyaWQnLFxuICAgIGFwcFZpc2libGU6IGZ1bmN0aW9uKHZpc2liaWxpdHkpIHtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHRoaXMuYXBwU2VsZWN0b3IpLCBmdW5jdGlvbihlbCkge1xuICAgICAgICAgICAgZWwuc3R5bGUudmlzaWJpbGl0eSA9IHZpc2liaWxpdHk7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBvbk9wZW46IG51bGxQYXR0ZXJuLFxuICAgIG9uT3BlbmVkOiBudWxsUGF0dGVybixcbiAgICBvbkNsb3NlOiBudWxsUGF0dGVybixcbiAgICBvbkNsb3NlZDogbnVsbFBhdHRlcm4sXG4gICAgdGVybWluYXRlOiBudWxsUGF0dGVyblxufSk7XG5cbmZ1bmN0aW9uIG51bGxQYXR0ZXJuKCkge31cblxuZnVuY3Rpb24gcmVtb3ZlRGlhbG9nKGV2dCkge1xuICAgIGlmIChldnQudGFyZ2V0ID09PSB0aGlzLmVsICYmIGV2dC5wcm9wZXJ0eU5hbWUgPT09ICdvcGFjaXR5Jykge1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCB0aGlzLnJlbW92ZURpYWxvZ0JvdW5kKTtcblxuICAgICAgICBpZiAodGhpcy5lbC5wYXJlbnRFbGVtZW50LnRhZ05hbWUgIT09ICdCT0RZJykge1xuICAgICAgICAgICAgdGhpcy5lbC5wYXJlbnRFbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmVsLnJlbW92ZSgpO1xuICAgICAgICBkZWxldGUgdGhpcy5lbDtcblxuICAgICAgICB0aGlzLm9uQ2xvc2VkKCk7XG4gICAgICAgIHRoaXMudGVybWluYXRlKCk7XG4gICAgICAgIHRoaXMuY2xvc2luZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmNsb3NlZCA9IHRydWU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoaWRlQXBwKGV2dCkge1xuICAgIGlmIChldnQudGFyZ2V0ID09PSB0aGlzLmVsICYmIGV2dC5wcm9wZXJ0eU5hbWUgPT09ICdvcGFjaXR5Jykge1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCB0aGlzLmhpZGVBcHBCb3VuZCk7XG5cbiAgICAgICAgdGhpcy5hcHBWaXNpYmxlKCdoaWRkZW4nKTtcbiAgICAgICAgdGhpcy5vbk9wZW5lZCgpO1xuICAgICAgICB0aGlzLm9wZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5vcGVuZWQgPSB0cnVlO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25DbGljayhldnQpIHtcbiAgICBpZiAodGhpcykge1xuICAgICAgICBpZiAoZXZ0LnRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ2h5cGVyZ3JpZC1kaWFsb2ctY2xvc2UnKSkge1xuICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7IC8vIGlnbm9yZSBocmVmXG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChldnQudGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnaHlwZXJncmlkLWRpYWxvZy1zZXR0aW5ncycpKSB7XG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTsgLy8gaWdub3JlIGhyZWZcbiAgICAgICAgICAgIGlmICh0aGlzLnNldHRpbmdzKSB7IHRoaXMuc2V0dGluZ3MoKTsgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5vbkNsaWNrICYmICF0aGlzLm9uQ2xpY2suY2FsbCh0aGlzLCBldnQpICYmIGV2dC50YXJnZXQudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTsgLy8gaWdub3JlIGhyZWYgb2YgaGFuZGxlZCBldmVudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpOyAvLyB0aGUgY2xpY2sgc3RvcHMgaGVyZSwgaGFuZGxlZCBvciBub3Rcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEaWFsb2c7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVGFieiA9IHJlcXVpcmUoJ3RhYnonKTtcbnZhciBwb3BNZW51ID0gcmVxdWlyZSgncG9wLW1lbnUnKTtcbnZhciBhdXRvbWF0ID0gcmVxdWlyZSgnYXV0b21hdCcpO1xuXG52YXIgRGlhbG9nID0gcmVxdWlyZSgnLi9EaWFsb2cnKTtcbnZhciBtYXJrdXAgPSByZXF1aXJlKCcuLi9odG1sJyk7XG52YXIgY29weUlucHV0ID0gcmVxdWlyZSgnLi9jb3B5LWlucHV0Jyk7XG5cbnZhciB0YWJQcm9wZXJ0aWVzID0ge1xuICAgIHRhYmxlUUI6IHtcbiAgICAgICAgaXNUYWJsZUZpbHRlcjogdHJ1ZVxuICAgIH0sXG4gICAgdGFibGVTUUw6IHtcbiAgICAgICAgaXNUYWJsZUZpbHRlcjogdHJ1ZSxcbiAgICAgICAgbGFuZ3VhZ2U6ICdTUUwnXG4gICAgfSxcbiAgICBjb2x1bW5zUUI6IHtcbiAgICAgICAgaXNDb2x1bW5GaWx0ZXI6IHRydWVcbiAgICB9LFxuICAgIGNvbHVtbnNTUUw6IHtcbiAgICAgICAgaXNDb2x1bW5GaWx0ZXI6IHRydWUsXG4gICAgICAgIGxhbmd1YWdlOiAnU1FMJ1xuICAgIH0sXG4gICAgY29sdW1uc0NRTDoge1xuICAgICAgICBpc0NvbHVtbkZpbHRlcjogdHJ1ZSxcbiAgICAgICAgbGFuZ3VhZ2U6ICdDUUwnXG4gICAgfVxufTtcblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBleHRlbmRzIERpYWxvZ1xuICovXG52YXIgTWFuYWdlRmlsdGVycyA9IERpYWxvZy5leHRlbmQoJ01hbmFnZUZpbHRlcnMnLCB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBNYXkgaW5jbHVkZSBgRGlhbG9nYCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFtvcHRpb25zLmNvbnRhaW5lcj1kb2N1bWVudC5ib2R5XVxuICAgICAqL1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKGdyaWQsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5maWx0ZXIgPSBncmlkLmZpbHRlcjtcblxuICAgICAgICB0aGlzLmFwcGVuZChtYXJrdXAuZmlsdGVyVHJlZXMpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgdGhlIGZvbGRlciB0YWJzXG4gICAgICAgIHZhciB0YWJ6ID0gdGhpcy50YWJ6ID0gbmV3IFRhYnooe1xuICAgICAgICAgICAgcm9vdDogdGhpcy5lbCxcbiAgICAgICAgICAgIG9uRW5hYmxlOiByZW5kZXJGb2xkZXIuYmluZCh0aGlzKSxcbiAgICAgICAgICAgIG9uRGlzYWJsZTogc2F2ZUZvbGRlcnMuYmluZCh0aGlzLCBudWxsKSAvLyBudWxsIG9wdGlvbnNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gd2lyZS11cCB0aGUgTmV3IENvbHVtbiBkcm9wLWRvd25cbiAgICAgICAgdmFyIG5ld0NvbHVtbkRyb3BEb3duID0gdGhpcy5lbC5xdWVyeVNlbGVjdG9yKCcjYWRkLWNvbHVtbi1maWx0ZXItc3ViZXhwcmVzc2lvbicpO1xuICAgICAgICBuZXdDb2x1bW5Ecm9wRG93bi5vbm1vdXNlZG93biA9IG9uTmV3Q29sdW1uTW91c2VEb3duLmJpbmQodGhpcyk7XG4gICAgICAgIG5ld0NvbHVtbkRyb3BEb3duLm9uY2hhbmdlID0gb25OZXdDb2x1bW5DaGFuZ2UuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBwdXQgdGhlIHR3byBzdWJ0cmVlcyBpbiB0aGUgdHdvIHBhbmVsc1xuICAgICAgICB0YWJ6LmZvbGRlcignI3RhYmxlUUInKS5hcHBlbmRDaGlsZCh0aGlzLmZpbHRlci50YWJsZUZpbHRlci5lbCk7XG4gICAgICAgIHRhYnouZm9sZGVyKCcjY29sdW1uc1FCJykuYXBwZW5kQ2hpbGQodGhpcy5maWx0ZXIuY29sdW1uRmlsdGVycy5lbCk7XG5cbiAgICAgICAgLy8gY29weSB0aGUgU1FMIG1vcmUtaW5mbyBibG9jayBmcm9tIHRoZSB0YWJsZSB0byB0aGUgY29sdW1ucyB0YWJcbiAgICAgICAgdmFyIGNvbHVtblNxbEVsID0gdGFiei5mb2xkZXIoJyNjb2x1bW5zU1FMJyk7XG4gICAgICAgIHZhciBtb3JlU3FsSW5mbyA9IHRhYnouZm9sZGVyKCcjdGFibGVTUUwnKS5maXJzdEVsZW1lbnRDaGlsZC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIGNvbHVtblNxbEVsLmluc2VydEJlZm9yZShtb3JlU3FsSW5mbywgY29sdW1uU3FsRWwuZmlyc3RDaGlsZCk7XG5cbiAgICAgICAgLy8gYWRkIGl0IHRvIHRoZSBET01cbiAgICAgICAgdGhpcy5vcGVuKG9wdGlvbnMuY29udGFpbmVyKTtcblxuICAgICAgICAvLyBmb2xsb3dpbmcgbmVlZGVkIGZvciB1bmNsZWFyIHJlYXNvbnMgdG8gZ2V0IGRyb3AtZG93biB0byBkaXNwbGF5IGNvcnJlY3RseVxuICAgICAgICBuZXdDb2x1bW5Ecm9wRG93bi5zZWxlY3RlZEluZGV4ID0gMDtcbiAgICB9LFxuXG4gICAgb25DbG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzYXZlRm9sZGVycy5jYWxsKHRoaXMpO1xuICAgIH0sXG5cbiAgICBvbkNsb3NlZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBiZWhhdmlvciA9IHRoaXMuZ3JpZC5iZWhhdmlvcjtcbiAgICAgICAgdGhpcy5ncmlkLnRha2VGb2N1cygpO1xuICAgICAgICB0aGlzLmdyaWQuYWxsb3dFdmVudHModHJ1ZSk7XG4gICAgICAgIGJlaGF2aW9yLnJlaW5kZXgoKTtcbiAgICAgICAgYmVoYXZpb3IuY2hhbmdlZCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gY2xpY2sgaGFuZGxlcnM7IGNhbGxlZCBieSBjdXJ0YWluLm9uY2xpY2sgaW4gY29udGV4dFxuICAgICAqIEBwYXJhbSBldnRcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvbkNsaWNrOiBmdW5jdGlvbihldnQpIHsgLy8gdG8gYmUgY2FsbGVkIHdpdGggZmlsdGVyIG9iamVjdCBhcyBzeW50YXhcbiAgICAgICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0O1xuXG4gICAgICAgIGlmIChjdHJsLmNsYXNzTGlzdC5jb250YWlucygnbW9yZS1pbmZvJykpIHtcbiAgICAgICAgICAgIC8vIGZpbmQgYWxsIG1vcmUtaW5mbyBsaW5rcyBhbmQgdGhlaXIgYWRqYWNlbnQgYmxvY2tzIChibG9ja3MgYWx3YXlzIGZvbGxvdyBsaW5rcylcbiAgICAgICAgICAgIHZhciBlbHMgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb3JlLWluZm8nKTtcblxuICAgICAgICAgICAgLy8gaGlkZSBhbGwgbW9yZS1pbmZvIGJsb2NrcyBleGNlcHQgdGhlIG9uZSBmb2xsb3dpbmcgdGhpcyBsaW5rICh1bmxlc3MgaXQncyBhbHJlYWR5IHZpc2libGUgaW4gd2hpY2ggY2FzZSBoaWRlIGl0IHRvbykuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVscy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBlbCA9IGVsc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmb3VuZCA9IGVsID09PSBjdHJsO1xuICAgICAgICAgICAgICAgICAgICBlbC5jbGFzc0xpc3RbZm91bmQgPyAndG9nZ2xlJyA6ICdyZW1vdmUnXSgnaGlkZS1pbmZvJyk7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gZWxzW2kgKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgZWwuc3R5bGUuZGlzcGxheSA9IGZvdW5kICYmIGVsLnN0eWxlLmRpc3BsYXkgIT09ICdibG9jaycgPyAnYmxvY2snIDogJ25vbmUnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKGN0cmwuY2xhc3NMaXN0LmNvbnRhaW5zKCdmaWx0ZXItY29weScpKSB7XG4gICAgICAgICAgICB2YXIgaXNDb3B5QWxsID0gY3RybC5jaGlsZE5vZGVzLmxlbmd0aDsgLy8gY29udGFpbnMgXCJBbGxcIlxuICAgICAgICAgICAgaWYgKGlzQ29weUFsbCkge1xuICAgICAgICAgICAgICAgIGN0cmwgPSB0aGlzLnRhYnouZm9sZGVyKGN0cmwpLnF1ZXJ5U2VsZWN0b3IoY29weUlucHV0LnNlbGVjdG9yVGV4dENvbnRyb2xzKTtcbiAgICAgICAgICAgICAgICBjb3B5SW5wdXQoY3RybCwgdGhpcy5maWx0ZXIuY29sdW1uRmlsdGVycy5nZXRTdGF0ZSh7IHN5bnRheDogJ1NRTCcgfSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb3B5SW5wdXQoY3RybC5wYXJlbnRFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoY29weUlucHV0LnNlbGVjdG9yVGV4dENvbnRyb2xzKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBtZWFucyB1bmhhbmRsZWRcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG4vKipcbiAqIEBwYXJhbSBvcHRpb25zXG4gKiBAcGFyYW0gdGFiXG4gKiBAcGFyYW0gZm9sZGVyXG4gKiBAcGFyYW0gW3BhbmVsXSBQYW5lbCB0byBzYXZlIChmcm9tIHRhYiBjbGljaykuIElmIG9taXR0ZWQsIHNhdmUgYm90aCBwYW5lbHMgKGZyb20gb25jbG9zZSkuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbnx1bmRlZmluZWR8c3RyaW5nfVxuICovXG5mdW5jdGlvbiBzYXZlRm9sZGVycyhvcHRpb25zLCB0YWIsIGZvbGRlciwgcGFuZWwpIHtcbiAgICByZXR1cm4gKFxuICAgICAgICAoIXBhbmVsIHx8IHBhbmVsLmlkID09PSAndGFibGVGaWx0ZXJQYW5lbCcpICYmIHNhdmVGb2xkZXIuY2FsbCh0aGlzLCB0aGlzLmZpbHRlci50YWJsZUZpbHRlciwgb3B0aW9ucykgfHxcbiAgICAgICAgKCFwYW5lbCB8fCBwYW5lbC5pZCA9PT0gJ2NvbHVtbkZpbHRlcnNQYW5lbCcpICYmIHNhdmVGb2xkZXIuY2FsbCh0aGlzLCB0aGlzLmZpbHRlci5jb2x1bW5GaWx0ZXJzLCBvcHRpb25zKVxuICAgICk7XG59XG5cbi8qKlxuICogQHRoaXMgRmlsdGVyXG4gKiBAcGFyYW0ge0RlZmF1bHRGaWx0ZXJ9IHN1YnRyZWVcbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucz17YWxlcnQ6dHJ1ZSxmb2N1czp0cnVlfV0gLSBTaWRlIGVmZmVjdHMgYXMgcGVyIGBGaWx0ZXJUcmVlLnByb3RvdHlwZS5pbnZhbGlkYCdzIGBvcHRpb25zYCcgcGFyYW1ldGVyLlxuICogQHJldHVybnMge3VuZGVmaW5lZHxzdHJpbmd9IC0gVmFsaWRhdGlvbiBlcnJvciB0ZXh0OyBmYWxzeSBtZWFucyB2YWxpZCAobm8gZXJyb3IpLlxuICovXG5mdW5jdGlvbiBzYXZlRm9sZGVyKHN1YnRyZWUsIG9wdGlvbnMpIHsgLy8gdG8gYmUgY2FsbGVkIHdpdGggZmlsdGVyIG9iamVjdCBhcyBzeW50YXhcbiAgICB2YXIgaXNDb2x1bW5GaWx0ZXJzID0gc3VidHJlZSA9PT0gdGhpcy5maWx0ZXIuY29sdW1uRmlsdGVycyxcbiAgICAgICAgdGFiUXVlcnlCdWlsZGVyID0gdGhpcy50YWJ6LnRhYihpc0NvbHVtbkZpbHRlcnMgPyAnI2NvbHVtbnNRQicgOiAnI3RhYmxlUUInKSxcbiAgICAgICAgdGFiID0gdGhpcy50YWJ6LmVuYWJsZWRUYWIodGFiUXVlcnlCdWlsZGVyKSxcbiAgICAgICAgZm9sZGVyID0gdGhpcy50YWJ6LmZvbGRlcih0YWIpLFxuICAgICAgICBpc1F1ZXJ5QnVpbGRlciA9IHRhYiA9PT0gdGFiUXVlcnlCdWlsZGVyLFxuICAgICAgICBkZWZhdWx0ZWRPcHRpb25zID0gb3B0aW9ucyB8fCB7XG4gICAgICAgICAgICBhbGVydDogdHJ1ZSxcbiAgICAgICAgICAgIGZvY3VzOiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIGVuaGFuY2VkT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGFsZXJ0OiBkZWZhdWx0ZWRPcHRpb25zLmFsZXJ0LFxuICAgICAgICAgICAgZm9jdXM6IGRlZmF1bHRlZE9wdGlvbnMuZm9jdXMgJiYgaXNRdWVyeUJ1aWxkZXJcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3IsIGN0cmw7XG5cbiAgICBpZiAoaXNDb2x1bW5GaWx0ZXJzIHx8IGlzUXVlcnlCdWlsZGVyKSB7XG4gICAgICAgIGVycm9yID0gc3VidHJlZS5pbnZhbGlkKGVuaGFuY2VkT3B0aW9ucyk7XG4gICAgfSBlbHNlIHsgLy8gdGFibGUgZmlsdGVyIFNRTCB0YWJcbiAgICAgICAgY3RybCA9IGZvbGRlci5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYScpO1xuICAgICAgICBlcnJvciA9IHRoaXMuZmlsdGVyLnNldFRhYmxlRmlsdGVyU3RhdGUoY3RybC52YWx1ZSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yICYmICFpc1F1ZXJ5QnVpbGRlcikge1xuICAgICAgICAvLyBJZiB0aGVyZSB3YXMgYSB2YWxpZGF0aW9uIGVycm9yLCBtb3ZlIHRoZSBmb2N1cyBmcm9tIHRoZSBxdWVyeSBidWlsZGVyIGNvbnRyb2wgdG8gdGhlIHRleHQgYm94IGNvbnRyb2wuXG4gICAgICAgIGlmIChpc0NvbHVtbkZpbHRlcnMpIHtcbiAgICAgICAgICAgIC8vIFdlJ3JlIGluIFNRTCBvciBDUUwgdGFiIHNvIGZpbmQgdGV4dCBib3ggdGhhdCBnb2VzIHdpdGggdGhpcyBzdWJleHByZXNzaW9uIGFuZCBmb2N1cyBvbiBpdCBpbnN0ZWFkIG9mIFFCIGNvbnRyb2wuXG4gICAgICAgICAgICB2YXIgZXJyYW50Q29sdW1uTmFtZSA9IGVycm9yLm5vZGUuZWwucGFyZW50RWxlbWVudC5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpLnZhbHVlO1xuICAgICAgICAgICAgY3RybCA9IGZvbGRlci5xdWVyeVNlbGVjdG9yKCdbbmFtZT1cIicgKyBlcnJhbnRDb2x1bW5OYW1lICsgJ1wiXScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGN0cmwpIHtcbiAgICAgICAgZGVjb3JhdGVGaWx0ZXJJbnB1dChjdHJsLCBlcnJvcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVycm9yO1xufVxuXG5mdW5jdGlvbiBkZWNvcmF0ZUZpbHRlcklucHV0KGN0cmwsIGVycm9yKSB7XG4gICAgY3RybC5jbGFzc0xpc3QudG9nZ2xlKCdmaWx0ZXItdHJlZS1lcnJvcicsICEhZXJyb3IpO1xuXG4gICAgY3RybC5mb2N1cygpO1xuXG4gICAgLy8gZmluZCB0aGUgbmVhcmJ5IHdhcm5pbmcgZWxlbWVudFxuICAgIHZhciB3YXJuaW5nRWw7XG4gICAgZG8ge1xuICAgICAgICBjdHJsID0gY3RybC5wYXJlbnRFbGVtZW50O1xuICAgICAgICB3YXJuaW5nRWwgPSBjdHJsLnF1ZXJ5U2VsZWN0b3IoJy5maWx0ZXItdHJlZS13YXJuJyk7XG4gICAgfSB3aGlsZSAoIXdhcm5pbmdFbCk7XG5cbiAgICAvLyBzaG93IG9yIGhpZGUgdGhlIGVycm9yXG4gICAgd2FybmluZ0VsLmlubmVySFRNTCA9IGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IgfHwgJyc7XG59XG5cbmZ1bmN0aW9uIG9uTmV3Q29sdW1uTW91c2VEb3duKGV2dCkgeyAvLyB0byBiZSBjYWxsZWQgd2l0aCBmaWx0ZXIgb2JqZWN0IGFzIHN5bnRheFxuICAgIGlmIChzYXZlRm9sZGVyLmNhbGwodGhpcywgdGhpcy5maWx0ZXIuY29sdW1uRmlsdGVycykpIHtcbiAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7IC8vIGRvIG5vdCBkcm9wIGRvd25cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyAocmUpYnVpbGQgdGhlIGRyb3AtZG93biBjb250ZW50cywgd2l0aCBzYW1lIHByb21wdCwgYnV0IGV4Y2x1ZGluZyBjb2x1bW5zIHdpdGggYWN0aXZlIGZpbHRlciBzdWJleHByZXNzaW9uc1xuICAgICAgICB2YXIgY3RybCA9IGV2dC50YXJnZXQsXG4gICAgICAgICAgICBwcm9tcHQgPSBjdHJsLm9wdGlvbnNbMF0udGV4dC5yZXBsYWNlKCfigKYnLCAnJyksIC8vIHVzZSBvcmlnaW5hbCBidXQgdy9vIGVsbGlwc2lzIGFzIC5idWlsZCgpIGFwcGVuZHMgb25lXG4gICAgICAgICAgICBibGFja2xpc3QgPSB0aGlzLmZpbHRlci5jb2x1bW5GaWx0ZXJzLmNoaWxkcmVuLm1hcChmdW5jdGlvbihjb2x1bW5GaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY29sdW1uRmlsdGVyLmNoaWxkcmVuLmxlbmd0aCAmJiBjb2x1bW5GaWx0ZXIuY2hpbGRyZW5bMF0uY29sdW1uO1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHByb21wdDogcHJvbXB0LFxuICAgICAgICAgICAgICAgIGJsYWNrbGlzdDogYmxhY2tsaXN0XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHBvcE1lbnUuYnVpbGQoY3RybCwgdGhpcy5maWx0ZXIucm9vdC5zY2hlbWEsIG9wdGlvbnMpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25OZXdDb2x1bW5DaGFuZ2UoZXZ0KSB7XG4gICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0LFxuICAgICAgICB0YWJDb2x1bW5RQiA9IHRoaXMudGFiei5mb2xkZXIoJyN0YWJsZVFCJyksXG4gICAgICAgIHRhYiA9IHRoaXMudGFiei5lbmFibGVkVGFiKHRhYkNvbHVtblFCLnBhcmVudEVsZW1lbnQpLFxuICAgICAgICBpc1F1ZXJ5QnVpbGRlciA9IHRhYiA9PT0gdGFiQ29sdW1uUUIsXG4gICAgICAgIHRhYlByb3BzID0gdGFiUHJvcGVydGllc1t0YWIuaWRdO1xuXG4gICAgdGhpcy5maWx0ZXIuY29sdW1uRmlsdGVycy5hZGQoe1xuICAgICAgICBzdGF0ZToge1xuICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcicsXG4gICAgICAgICAgICBjaGlsZHJlbjogWyB7IGNvbHVtbjogY3RybC52YWx1ZSB9IF1cbiAgICAgICAgfSxcbiAgICAgICAgZm9jdXM6IGlzUXVlcnlCdWlsZGVyXG4gICAgfSk7XG5cbiAgICBpZiAodGFiUHJvcHMuaXNDb2x1bW5GaWx0ZXIgJiYgdGFiUHJvcHMubGFudWdhZ2UpIHtcbiAgICAgICAgcmVuZGVyRm9sZGVyLmNhbGwodGhpcywgdGFiKTtcbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYWxsIGJ1dCB0aGUgcHJvbXB0IG9wdGlvbiAoZmlyc3QgY2hpbGQpXG4gICAgY3RybC5zZWxlY3RlZEluZGV4ID0gMDtcbiAgICB3aGlsZSAoY3RybC5sYXN0Q2hpbGQgIT09IGN0cmwuZmlyc3RDaGlsZCkge1xuICAgICAgICBjdHJsLnJlbW92ZUNoaWxkKGN0cmwubGFzdENoaWxkKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlckZvbGRlcih0YWIpIHsgLy8gdG8gYmUgY2FsbGVkIHdpdGggZmlsdGVyIG9iamVjdCBhcyBzeW50YXhcbiAgICB2YXIgdGFiUHJvcHMgPSB0YWJQcm9wZXJ0aWVzW3RhYi5pZF0sXG4gICAgICAgIHF1ZXJ5TGFuZ3VhZ2UgPSB0YWJQcm9wcy5sYW5ndWFnZTtcblxuICAgIGlmIChxdWVyeUxhbmd1YWdlKSB7XG4gICAgICAgIHZhciBnbG9iYWxGaWx0ZXIgPSB0aGlzLmZpbHRlcixcbiAgICAgICAgICAgIGZvbGRlciA9IHRoaXMudGFiei5mb2xkZXIodGFiKTtcblxuICAgICAgICBpZiAodGFiUHJvcHMuaXNUYWJsZUZpbHRlcikge1xuXG4gICAgICAgICAgICBmb2xkZXIucXVlcnlTZWxlY3RvcigndGV4dGFyZWEnKS52YWx1ZSA9IGdsb2JhbEZpbHRlci50YWJsZUZpbHRlci5nZXRTdGF0ZSh7IHN5bnRheDogJ1NRTCcgfSk7XG5cbiAgICAgICAgfSBlbHNlIHsgLy8gY29sdW1uIGZpbHRlclxuXG4gICAgICAgICAgICB2YXIgY29sdW1uRmlsdGVycyA9IGdsb2JhbEZpbHRlci5jb2x1bW5GaWx0ZXJzLmNoaWxkcmVuLFxuICAgICAgICAgICAgICAgIGVsID0gZm9sZGVyLmxhc3RFbGVtZW50Q2hpbGQsXG4gICAgICAgICAgICAgICAgbXNnRWwgPSBlbC5xdWVyeVNlbGVjdG9yKCdzcGFuJyksXG4gICAgICAgICAgICAgICAgbGlzdEVsID0gZWwucXVlcnlTZWxlY3Rvcignb2wnKSxcbiAgICAgICAgICAgICAgICBjb3B5QWxsTGluayA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ2E6Zmlyc3Qtb2YtdHlwZScpO1xuXG4gICAgICAgICAgICBtc2dFbC5pbm5lckhUTUwgPSBhY3RpdmVGaWx0ZXJzTWVzc2FnZShjb2x1bW5GaWx0ZXJzLmxlbmd0aCk7XG4gICAgICAgICAgICBsaXN0RWwuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGNvbHVtbiBmaWx0ZXIgc3VidHJlZSwgYXBwZW5kIGFuIDxsaT4uLi48L2xpPiBlbGVtZW50IGNvbnRhaW5pbmc6XG4gICAgICAgICAgICAvLyBjb2x1bW4gdGl0bGUsIFwiKGNvcHkpXCIgbGluaywgYW5kIGVkaXRhYmxlIHRleHQgaW5wdXQgYm94IGNvbnRhaW5pbmcgdGhlIHN1YmV4cHJlc3Npb25cbiAgICAgICAgICAgIGNvbHVtbkZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbihmaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29uZGl0aW9uYWwgPSBmaWx0ZXIuY2hpbGRyZW5bMF0sXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0gPSBjb25kaXRpb25hbC5zY2hlbWFbMF0sXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgPSBjb25kaXRpb25hbC5jb2x1bW4sXG4gICAgICAgICAgICAgICAgICAgIGFsaWFzID0gaXRlbS5hbGlhcyB8fCBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBleHByZXNzaW9uID0gZmlsdGVyLmdldFN0YXRlKHsgc3ludGF4OiBxdWVyeUxhbmd1YWdlIH0pLFxuICAgICAgICAgICAgICAgICAgICBpc051bGwgPSBleHByZXNzaW9uID09PSAnKE5VTEwgSVMgTlVMTCknIHx8IGV4cHJlc3Npb24gPT09ICcnLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50ID0gaXNOdWxsID8gJycgOiBleHByZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWUgPSBpc051bGwgPyAnZmlsdGVyLXRyZWUtZXJyb3InIDogJycsXG4gICAgICAgICAgICAgICAgICAgIGxpID0gYXV0b21hdC5maXJzdENoaWxkKG1hcmt1cFtxdWVyeUxhbmd1YWdlXSwgYWxpYXMsIG5hbWUsIGNvbnRlbnQsIGNsYXNzTmFtZSk7XG5cbiAgICAgICAgICAgICAgICBsaXN0RWwuYXBwZW5kQ2hpbGQobGkpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvbGRlci5vbmtleXVwID0gc2V0Q29sdW1uRmlsdGVyU3RhdGUuYmluZCh0aGlzLCBxdWVyeUxhbmd1YWdlKTtcblxuICAgICAgICAgICAgaWYgKGNvcHlBbGxMaW5rKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlcmUncyBhIFwiKGNvcHkgYWxsKVwiIGxpbmssIGhpZGUgaXQgaWYgb25seSAwIG9yIDEgc3ViZXhwcmVzc2lvbnNcbiAgICAgICAgICAgICAgICBjb3B5QWxsTGluay5zdHlsZS5kaXNwbGF5ID0gY29sdW1uRmlsdGVycy5sZW5ndGggPiAxID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG4vL3ZhciBSRVRVUk5fS0VZID0gMHgwZCwgRVNDQVBFX0tFWSA9IDB4MWI7XG4vKipcbiAqIENhbGxlZCBmcm9tIGtleS11cCBldmVudHMgZnJvbSBgI2NvbHVtblNRTGAgYW5kIGAjY29sdW1uQ1FMYCB0YWJzLlxuICogQHRoaXMgRmlsdGVyXG4gKiBAcGFyYW0ge3N0cmluZ30gcXVlcnlMYW5ndWFnZVxuICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldnRcbiAqL1xuZnVuY3Rpb24gc2V0Q29sdW1uRmlsdGVyU3RhdGUocXVlcnlMYW5ndWFnZSwgZXZ0KSB7XG4gICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0O1xuXG4gICAgLy8gT25seSBoYW5kbGUgaWYga2V5IHdhcyBwcmVzc2VkIGluc2lkZSBhIHRleHQgYm94LlxuICAgIGlmIChjdHJsLmNsYXNzTGlzdC5jb250YWlucygnZmlsdGVyLXRleHQtYm94JykpIHtcbiAgICAgICAgLy9zd2l0Y2ggKGV2dC5rZXlDb2RlKSB7XG4gICAgICAgIC8vICAgIGNhc2UgRVNDQVBFX0tFWTpcbiAgICAgICAgLy8gICAgICAgIGN0cmwudmFsdWUgPSBvbGRBcmc7XG4gICAgICAgIC8vICAgIGNhc2UgUkVUVVJOX0tFWTogLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1mYWxsdGhyb3VnaFxuICAgICAgICAvLyAgICAgICAgY3RybC5ibHVyKCk7XG4gICAgICAgIC8vICAgICAgICBicmVhaztcbiAgICAgICAgLy8gICAgZGVmYXVsdDpcbiAgICAgICAgdmFyIGVycm9yLFxuICAgICAgICAgICAgb3B0aW9ucyA9IHsgc3ludGF4OiBxdWVyeUxhbmd1YWdlLCBhbGVydDogdHJ1ZSB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBlcnJvciA9IHRoaXMuZmlsdGVyLnNldENvbHVtbkZpbHRlclN0YXRlKGN0cmwubmFtZSwgY3RybC52YWx1ZSwgb3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZXJyb3IgPSBlcnI7XG4gICAgICAgIH1cblxuICAgICAgICBkZWNvcmF0ZUZpbHRlcklucHV0KGN0cmwsIGVycm9yKTtcbiAgICAgICAgLy99XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhY3RpdmVGaWx0ZXJzTWVzc2FnZShuKSB7XG4gICAgdmFyIHJlc3VsdDtcblxuICAgIHN3aXRjaCAobikge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICByZXN1bHQgPSAnVGhlcmUgYXJlIG5vIGFjdGl2ZSBjb2x1bW4gZmlsdGVycy4nO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHJlc3VsdCA9ICdUaGVyZSBpcyAxIGFjdGl2ZSBjb2x1bW4gZmlsdGVyOic7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJlc3VsdCA9ICdUaGVyZSBhcmUgJyArIG4gKyAnIGFjdGl2ZSBjb2x1bW4gZmlsdGVyczonO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNYW5hZ2VGaWx0ZXJzO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW2NvbnRhaW5pbmdFbD1kb2N1bWVudF1cbiAqIEBwYXJhbSB7c3RyaW5nfSBbcHJlZml4PScnXVxuICogQHBhcmFtIHtzdHJpbmd9IFtzZXBhcmF0b3I9JyddXG4gKiBAcGFyYW0ge3N0cmluZ30gW3N1ZmZpeD0nJ11cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IFt0cmFuc2Zvcm1lcj1tdWx0aUxpbmVUcmltXSAtIEZ1bmN0aW9uIHRvIHRyYW5zZm9ybSBlYWNoIGlucHV0IGNvbnRyb2wncyB0ZXh0IHZhbHVlLlxuICovXG5mdW5jdGlvbiBjb3B5QWxsKGNvbnRhaW5pbmdFbCwgcHJlZml4LCBzZXBhcmF0b3IsIHN1ZmZpeCwgdHJhbnNmb3JtZXIpIHtcbiAgICB2YXIgdGV4dHMgPSBbXSwgbGFzdFRleHRFbCwgdGV4dDtcblxuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoKGNvbnRhaW5pbmdFbCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjb3B5QWxsLnNlbGVjdG9yKSwgZnVuY3Rpb24odGV4dEVsKSB7XG4gICAgICAgIHRleHQgPSAodHJhbnNmb3JtZXIgfHwgbXVsdGlMaW5lVHJpbSkodGV4dEVsLnZhbHVlKTtcbiAgICAgICAgaWYgKHRleHQpIHsgdGV4dHMucHVzaCh0ZXh0KTsgfVxuICAgICAgICBsYXN0VGV4dEVsID0gdGV4dEVsO1xuICAgIH0pO1xuXG4gICAgaWYgKGxhc3RUZXh0RWwpIHtcbiAgICAgICAgY29weShsYXN0VGV4dEVsLCAocHJlZml4IHx8ICcnKSArIHRleHRzLmpvaW4oc2VwYXJhdG9yIHx8ICcnKSArIChzdWZmaXggfHwgJycpKTtcbiAgICB9XG59XG5cbi8qKlxuICogMS4gVHJpbSB0aGUgdGV4dCBpbiB0aGUgZ2l2ZW4gaW5wdXQgZWxlbWVudFxuICogMi4gc2VsZWN0IGl0XG4gKiAzLiBjb3B5IGl0IHRvIHRoZSBjbGlwYm9hcmRcbiAqIDQuIGRlc2VsZWN0IGl0XG4gKiA1LiByZXR1cm4gaXRcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8SFRNTFRleHRBcmVhRWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7c3RyaW5nfSBbdGV4dD1lbC52YWx1ZV0gLSBUZXh0IHRvIGNvcHkuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfHN0cmluZ30gVHJpbW1lZCB0ZXh0IGluIGVsZW1lbnQgb3IgdW5kZWZpbmVkIGlmIHVuYWJsZSB0byBjb3B5LlxuICovXG5mdW5jdGlvbiBjb3B5KGVsLCB0ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCwgdGV4dFdhcztcblxuICAgIGlmICh0ZXh0KSB7XG4gICAgICAgIHRleHRXYXMgPSBlbC52YWx1ZTtcbiAgICAgICAgZWwudmFsdWUgPSB0ZXh0O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRleHQgPSBlbC52YWx1ZTtcbiAgICB9XG5cbiAgICBlbC52YWx1ZSA9IG11bHRpTGluZVRyaW0odGV4dCk7XG5cbiAgICB0cnkge1xuICAgICAgICBlbC5zZWxlY3QoKTtcbiAgICAgICAgcmVzdWx0ID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKHRleHRXYXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZWwudmFsdWUgPSB0ZXh0V2FzO1xuICAgICAgICB9XG4gICAgICAgIGVsLmJsdXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gbXVsdGlMaW5lVHJpbShzKSB7XG4gICAgcmV0dXJuIHMucmVwbGFjZSgvXlxccyooLio/KVxccyokLywgJyQxJyk7XG59XG5cbmNvcHkuYWxsID0gY29weUFsbDtcbmNvcHkubXVsdGlMaW5lVHJpbSA9IG11bHRpTGluZVRyaW07XG5jb3B5LnNlbGVjdG9yVGV4dENvbnRyb2xzID0gJ2lucHV0Om5vdChbdHlwZV0pLCBpbnB1dFt0eXBlPXRleHRdLCB0ZXh0YXJlYSc7XG5cbm1vZHVsZS5leHBvcnRzID0gY29weTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMuQ29sdW1uUGlja2VyID0gcmVxdWlyZSgnLi9Db2x1bW5QaWNrZXInKTtcbm1vZHVsZS5leHBvcnRzLk1hbmFnZUZpbHRlcnMgPSByZXF1aXJlKCcuL01hbmFnZUZpbHRlcnMnKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG92ZXJyaWRlciA9IHJlcXVpcmUoJ292ZXJyaWRlcicpO1xuXG4vKipcbiAqIEBwYXJhbSB7SHlwZXJncmlkfSBncmlkXG4gKiBAcGFyYW0ge29iamVjdH0gW3RhcmdldHNdIC0gSGFzaCBvZiBtaXhpbiB0YXJnZXRzLiBUaGVzZSBhcmUgdHlwaWNhbGx5IHByb3RvdHlwZSBvYmplY3RzLiBJZiBub3QgZ2l2ZW4gb3IgYW55IHRhcmdldHMgYXJlIG1pc3NpbmcsIGRlZmF1bHRzIHRvIGN1cnJlbnQgZ3JpZCdzIHZhcmlvdXMgcHJvdG90eXBlcy5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEaWFsb2dVSShncmlkLCB0YXJnZXRzKSB7XG4gICAgdGhpcy5ncmlkID0gZ3JpZDtcbiAgICB0YXJnZXRzID0gdGFyZ2V0cyB8fCB7fTtcblxuICAgIHZhciBIeXBlcmdyaWQgPSB0aGlzLmdyaWQuY29uc3RydWN0b3I7XG4gICAgSHlwZXJncmlkLmRlZmF1bHRzLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9kZWZhdWx0cycpKTtcblxuICAgIG1peEluVG8oJ0h5cGVyZ3JpZCcsIGdyaWQsIHJlcXVpcmUoJy4vbWl4LWlucy9ncmlkJykpO1xuICAgIG1peEluVG8oJ0JlaGF2aW9yJywgZ3JpZC5iZWhhdmlvciwgcmVxdWlyZSgnLi9taXgtaW5zL2JlaGF2aW9yJykpO1xuXG4gICAgZ3JpZC5hZGRJbnRlcm5hbEV2ZW50TGlzdGVuZXIoJ2Zpbi1rZXl1cCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIGNoYXJQcmVzc2VkID0gZS5kZXRhaWwuY2hhcjtcbiAgICAgICAgZ3JpZC5wcm9wZXJ0aWVzLmVkaXRvckFjdGl2YXRpb25LZXlzLmZpbmQoZnVuY3Rpb24oYWN0aXZhdGlvbktleSkge1xuICAgICAgICAgICAgdmFyIGlzQWN0aXZhdGlvbktleSA9IGNoYXJQcmVzc2VkID09PSBhY3RpdmF0aW9uS2V5LnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAoaXNBY3RpdmF0aW9uS2V5KSB7XG4gICAgICAgICAgICAgICAgZ3JpZC50b2dnbGVEaWFsb2coJ0NvbHVtblBpY2tlcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGlzQWN0aXZhdGlvbktleTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBtaXhJblRvKHRhcmdldCwgaW5zdGFuY2UsIG1peGluKSB7XG4gICAgICAgIHZhciBvYmplY3QgPSB0YXJnZXRzW3RhcmdldF07XG4gICAgICAgIHZhciBwcm90b3R5cGUgPSBvYmplY3QgJiYgb2JqZWN0LnByb3RvdHlwZSB8fCBPYmplY3QuZ2V0UHJvdG90eXBlT2YoaW5zdGFuY2UpO1xuXG4gICAgICAgIG92ZXJyaWRlcihwcm90b3R5cGUsIG1peGluKTtcbiAgICB9XG59XG5cbkRpYWxvZ1VJLnByb3RvdHlwZS4kJENMQVNTX05BTUUgPSAnRGlhbG9nVUknO1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpYWxvZ1VJO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLkNRTCA9IFtcbic8bGk+JyxcbidcdDxsYWJlbCB0aXRsZT1cIiR7MX1cIj4nLFxuJ1x0XHQ8YSB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJmaWx0ZXItY29weVwiPjwvYT4nLFxuJ1x0XHQ8ZGl2IGNsYXNzPVwiZmlsdGVyLXRyZWUtcmVtb3ZlLWJ1dHRvblwiIHRpdGxlPVwiZGVsZXRlIGNvbmRpdGlvbmFsXCI+PC9kaXY+JyxcbidcdFx0PHN0cm9uZz4lezB9Ojwvc3Ryb25nPicsXG4nXHRcdDxpbnB1dCBuYW1lPVwiJHsxfVwiIGNsYXNzPVwiZmlsdGVyLXRleHQtYm94ICR7M31cIiB2YWx1ZT1cIiV7Mn1cIj4nLFxuJ1x0PC9sYWJlbD4nLFxuJ1x0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXdhcm5cIj48L2Rpdj4nLFxuJzwvbGk+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5TUUwgPSBbXG4nPGxpPicsXG4nXHQ8bGFiZWwgdGl0bGU9XCIkezF9XCI+JyxcbidcdFx0PGEgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZmlsdGVyLWNvcHlcIj48L2E+JyxcbidcdFx0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2PicsXG4nXHRcdDxzdHJvbmc+JXswfTo8L3N0cm9uZz4nLFxuJ1x0XHQ8dGV4dGFyZWEgbmFtZT1cIiR7MX1cIiByb3dzPVwiMVwiIGNsYXNzPVwiZmlsdGVyLXRleHQtYm94ICR7M31cIj4lezJ9PC90ZXh0YXJlYT4nLFxuJ1x0PC9sYWJlbD4nLFxuJ1x0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXdhcm5cIj48L2Rpdj4nLFxuJzwvbGk+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5kaWFsb2cgPSBbXG4nPGRpdiBpZD1cImh5cGVyZ3JpZC1kaWFsb2dcIj4nLFxuJycsXG4nXHQ8c3R5bGU+JyxcbidcdFx0I2h5cGVyZ3JpZC1kaWFsb2cgeycsXG4nXHRcdFx0cG9zaXRpb246IGFic29sdXRlOycsXG4nXHRcdFx0dG9wOiAwOycsXG4nXHRcdFx0bGVmdDogMDsnLFxuJ1x0XHRcdGJvdHRvbTogMDsnLFxuJ1x0XHRcdHJpZ2h0OiAwOycsXG4nXHRcdFx0YmFja2dyb3VuZC1jb2xvcjogd2hpdGU7JyxcbidcdFx0XHRiYWNrZ3JvdW5kLWltYWdlOiB1cmwoZGF0YTpwbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFINEFBQUFVQ0FNQUFBQjhrbm1HQUFBQVhWQk1WRVhuNHRmbTRkZm40dGpuNDlubzVOcnA1ZHpwNU52bTRkYmkzTkRnMnMzbzVOdmw0TlRoMjg3azM5UHA1ZHZoM00vajNkSGszOVRsNE5YZzI4N2szdFBpM2RIaDNORG00dGZqM3RMaDI4L280OXJvNDluZzJzN2w0ZGJsNE5iNlZiRXlBQUFDMUVsRVFWUjRBWFZWMFlLREtBd0U0QUFWSzZTd0M5YnQvMy9tbllKMnRGN2V3TUVKeVdSZ2pITXVoRlQvbkVNYjI2MWh4YnJxaDIzaFJvbVloeExyWWZYQVRUbTZEVHYwNjBxMHZ4aDkrYitTWWozTXVqM2M1SU9SQUZNQkV0RDByS2dvQUhJSkxXTGxmcElHOHFBQUlrM3drOXRKS3oyRTg0R3JIVXZiVmhMYnl2dzBpQTIvNm90YS9RYmJ2ditZYlVla2JVVjZSL0RnM1lXTitaeXpUL2E4WDZLcEJMcFczY3RhMkZDT0xGTWtMdVplOTdQZ0ZKTTdqb2FHOWJVSGxWeVpXTTYzdEdsbFpwK3l6SXdpcEdGSlF3SjVycWdYMmU3L3c5S3J3dVlNQXRCa2dUYlM3M3owcjlKRDlJSnl5MkdKRWpTUUQ5a0p3aUllVFNOeHlDOUR6MlZjR2lLVDZJSHBscjdWeW5iQStVcFZBK2J4UVlpL2tOUGtuSnRTRG45Q2ZlYkJOUFNyWmRLMHIrNkltRThwNVJ6RG00c3pnRnRJUU5xbWUzWmtjQnNQMXJSdkpaQmJmcjZjNE84UWMwNHBnZkpyWTVyczRkSjVoaFowejl6Nit4MHZ5czhPeWo1bktFTVRQOG9MQncrN09BaDlUa0NkSjgvNU5ubzRkdDZkNTA2ZHliVVliaFREbUZqdHh3eGpUdmpWRGhJVGlKVk5vZTVMeW9HSVFrNEZ0ZCtRRWNubFlQRitLWStEV2MxV2dQU3FKZVhqWHhQcFQ5dVhvQnFHeDZtN2p5bHl2UnZtOGhHQXB1TkF5V2lzOThyWFl2ZXZaVlNndXpnZnc4a0dmM2FSNGdkMkROVWNRWDFxWEhhdnZMRnJwdjZML250L2QrOVJYVjhPRkRDRkVBaEhCdCtxU3I2L0ZOKzM3SlZTN0JDOXp3T1hqNi9KVzA0SkxCN205ODR2L0hJaVg3N203aUg1a0wxMTk4b3Y4T0kwemlYMDFiMzJGbzljM1ZIemNlOXhkY3MrTEMwVGVIUEtSZm11bE9MY1pmVHlXMklDejZEcjVGbDRGNDFvMXExblllQXRzNmJ1aGllU3kzZStrcXpNN1BQODg1QXRmQjBGSk9Db1VablVRU3lsbEFVM2ttazRja0F1UnFDMk9YQWgxYjN5bGFCajlLYTNQaWRRUXhKY0JFdEdyV1JuY3YyZWpyRWpWQ25TWDl0WU91QmswN1lJNEo2TVlwcGNCVTBwRWdPdkR0dit4Q0NUcnR3TDVsODd3Vk8zTy9nNUdRQUFBQUJKUlU1RXJrSmdnZz09KTsnLFxuJ1x0XHRcdGZvbnQ6IDEwcHQgc2Fucy1zZXJpZjsnLFxuJ1x0XHRcdG9wYWNpdHk6IDA7JyxcbidcdFx0XHR0cmFuc2l0aW9uOiBvcGFjaXR5IDFzOycsXG4nXHRcdFx0Ym94LXNoYWRvdzogcmdiYSgwLCAwLCAwLCAwLjI5ODAzOSkgMHB4IDE5cHggMzhweCwgcmdiYSgwLCAwLCAwLCAwLjIxOTYwOCkgMHB4IDE1cHggMTJweDsnLFxuJ1x0XHR9JyxcbidcdFx0I2h5cGVyZ3JpZC1kaWFsb2cuaHlwZXJncmlkLWRpYWxvZy12aXNpYmxlIHsnLFxuJ1x0XHRcdG9wYWNpdHk6IDE7JyxcbidcdFx0XHR0cmFuc2l0aW9uOiBvcGFjaXR5IDFzOycsXG4nXHRcdH0nLFxuJycsXG4nXHRcdCNoeXBlcmdyaWQtZGlhbG9nIC5oeXBlcmdyaWQtZGlhbG9nLWNvbnRyb2wtcGFuZWwgeycsXG4nXHRcdFx0cG9zaXRpb246IGFic29sdXRlOycsXG4nXHRcdFx0dG9wOiAwcHg7JyxcbidcdFx0XHRyaWdodDogMTJweDsnLFxuJ1x0XHR9JyxcbidcdFx0I2h5cGVyZ3JpZC1kaWFsb2cgLmh5cGVyZ3JpZC1kaWFsb2ctY29udHJvbC1wYW5lbCBhIHsnLFxuJ1x0XHRcdGNvbG9yOiAjOTk5OycsXG4nXHRcdFx0Zm9udC1zaXplOiAzM3B4OycsXG4nXHRcdFx0dHJhbnNpdGlvbjogdGV4dC1zaGFkb3cgLjM1cywgY29sb3IgLjM1czsnLFxuJ1x0XHRcdHRleHQtZGVjb3JhdGlvbjogbm9uZTsnLFxuJ1x0XHR9JyxcbidcdFx0I2h5cGVyZ3JpZC1kaWFsb2cgLmh5cGVyZ3JpZC1kaWFsb2ctY2xvc2U6YWZ0ZXIgeycsXG4nXHRcdFx0Y29udGVudDogXFwnXFxcXEQ3XFwnOycsXG4nXHRcdH0nLFxuJ1x0XHQjaHlwZXJncmlkLWRpYWxvZyAuaHlwZXJncmlkLWRpYWxvZy1zZXR0aW5nczphZnRlciB7JyxcbidcdFx0XHRmb250LWZhbWlseTogQXBwbGUgU3ltYm9sczsnLFxuJ1x0XHRcdGNvbnRlbnQ6IFxcJ1xcXFwyNjk5XFwnOycsXG4nXHRcdH0nLFxuJ1x0XHQjaHlwZXJncmlkLWRpYWxvZyAuaHlwZXJncmlkLWRpYWxvZy1jb250cm9sLXBhbmVsIGE6aG92ZXIgeycsXG4nXHRcdFx0Y29sb3I6IGJsYWNrOycsXG4nXHRcdFx0dGV4dC1zaGFkb3c6IDAgMCA2cHggIzMzN2FiNzsnLFxuJ1x0XHRcdHRyYW5zaXRpb246IHRleHQtc2hhZG93IC4zNXMsIGNvbG9yIC4zNXM7JyxcbidcdFx0fScsXG4nXHRcdCNoeXBlcmdyaWQtZGlhbG9nIC5oeXBlcmdyaWQtZGlhbG9nLWNvbnRyb2wtcGFuZWwgYTphY3RpdmUgeycsXG4nXHRcdFx0Y29sb3I6ICNkMDA7JyxcbidcdFx0XHR0cmFuc2l0aW9uOiBjb2xvciAwczsnLFxuJ1x0XHR9JyxcbidcdDwvc3R5bGU+JyxcbicnLFxuJ1x0PHNwYW4gY2xhc3M9XCJoeXBlcmdyaWQtZGlhbG9nLWNvbnRyb2wtcGFuZWxcIj4nLFxuJ1x0XHQ8YSBjbGFzcz1cImh5cGVyZ3JpZC1kaWFsb2ctc2V0dGluZ3NcIiB0aXRsZT1cIihUaGVyZSBhcmUgbm8gc2V0dGluZ3MgZm9yIE1hbmFnZSBGaWx0ZXJzIGF0IHRoaXMgdGltZS4pXCI+PC9hPicsXG4nXHRcdDxhIGNsYXNzPVwiaHlwZXJncmlkLWRpYWxvZy1jbG9zZVwiPjwvYT4nLFxuJ1x0PC9zcGFuPicsXG4nJyxcbic8L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLmZpbHRlclRyZWVzID0gW1xuJzxzdHlsZT4nLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgPiBkaXYgeycsXG4nXHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTsnLFxuJ1x0XHR0b3A6IDA7JyxcbidcdFx0bGVmdDogMDsnLFxuJ1x0XHRib3R0b206IDA7JyxcbidcdFx0cmlnaHQ6IDA7JyxcbidcdH0nLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgPiBkaXY6Zmlyc3Qtb2YtdHlwZSB7JyxcbidcdFx0cGFkZGluZzogMWVtIDFlbSAxZW0gMC41ZW07JyxcbidcdFx0bWFyZ2luLWxlZnQ6IDUwJTsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyA+IGRpdjpsYXN0LW9mLXR5cGUgeycsXG4nXHRcdHBhZGRpbmc6IDFlbSAwLjVlbSAxZW0gMWVtOycsXG4nXHRcdG1hcmdpbi1yaWdodDogNTAlOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nID4gZGl2ID4gcDpmaXJzdC1jaGlsZCB7JyxcbidcdFx0bWFyZ2luLXRvcDogMDsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyA+IGRpdiA+IHAgPiBzcGFuOmZpcnN0LWNoaWxkIHsnLFxuJ1x0XHRmb250LXNpemU6IGxhcmdlcjsnLFxuJ1x0XHRsZXR0ZXItc3BhY2luZzogMnB4OycsXG4nXHRcdGZvbnQtd2VpZ2h0OiBib2xkOycsXG4nXHRcdGNvbG9yOiAjNjY2OycsXG4nXHRcdG1hcmdpbi1yaWdodDogMWVtOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGlucHV0LCAjaHlwZXJncmlkLWRpYWxvZyB0ZXh0YXJlYSB7JyxcbidcdFx0b3V0bGluZTogMDsnLFxuJ1x0XHRsaW5lLWhlaWdodDogaW5pdGlhbDsnLFxuJ1x0fScsXG4nJyxcbidcdC50YWJ6IHsgei1pbmRleDogMCB9JyxcbidcdC50YWJ6ID4gcDpmaXJzdC1jaGlsZCwgLnRhYnogPiBzZWN0aW9uID4gcDpmaXJzdC1jaGlsZCwgLnRhYnogPiBzZWN0aW9uID4gZGl2ID4gcDpmaXJzdC1jaGlsZCB7IG1hcmdpbi10b3A6IDAgfScsXG4nJyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGEubW9yZS1pbmZvIHsgZm9udC1zaXplOiBzbWFsbGVyOyB9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGEubW9yZS1pbmZvOjphZnRlciB7IGNvbnRlbnQ6IFxcJyhtb3JlIGluZm8pXFwnOyB9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGEubW9yZS1pbmZvLmhpZGUtaW5mbyB7IGNvbG9yOiByZWQ7IH0nLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgYS5tb3JlLWluZm8uaGlkZS1pbmZvOjphZnRlciB7IGNvbnRlbnQ6IFxcJyhoaWRlIGluZm8pXFwnOyB9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGRpdi5tb3JlLWluZm8geycsXG4nXHRcdGJvcmRlcjogMXB4IHRhbiBzb2xpZDsnLFxuJ1x0XHRib3JkZXItcmFkaXVzOiA4cHg7JyxcbidcdFx0cGFkZGluZzogMCA4cHggLjJlbTsnLFxuJ1x0XHRkaXNwbGF5OiBub25lOycsXG4nXHRcdGJhY2tncm91bmQtY29sb3I6IGl2b3J5OycsXG4nXHRcdGJveC1zaGFkb3c6IDNweCAzcHggNXB4ICM3MDcwNzA7JyxcbidcdFx0bWFyZ2luLWJvdHRvbTogMWVtOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIGRpdi5tb3JlLWluZm8gPiBwIHsgbWFyZ2luOiAuNWVtIDA7IH0nLFxuJycsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiB1bCB7JyxcbidcdFx0cGFkZGluZy1sZWZ0OiAxLjVlbTsnLFxuJ1x0XHRsaXN0LXN0eWxlLXR5cGU6IGNpcmNsZTsnLFxuJ1x0XHRmb250LXdlaWdodDogYm9sZDsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiB1bCA+IGxpID4gdWwgeycsXG4nXHRcdGxpc3Qtc3R5bGUtdHlwZTogZGlzYzsnLFxuJ1x0XHRmb250LXdlaWdodDogbm9ybWFsOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIC50YWJ6IGxpIHsnLFxuJ1x0XHRtYXJnaW46IC4zZW0gMDsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiBsaSA+IGNvZGUgeycsXG4nXHRcdGJhY2tncm91bmQ6ICNlMGUwZTA7JyxcbidcdFx0bWFyZ2luOiAwIC4xZW07JyxcbidcdFx0cGFkZGluZzogMCA1cHg7JyxcbidcdFx0Ym9yZGVyLXJhZGl1czogNHB4OycsXG4nXHR9JyxcbicnLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgLnRhYnogPiBzZWN0aW9uLmZpbHRlci1leHByZXNzaW9uLXN5bnRheCA+IGRpdjpsYXN0LWNoaWxkIG9sIHsnLFxuJ1x0XHRwYWRkaW5nLWxlZnQ6IDEuNmVtOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIC50YWJ6ID4gc2VjdGlvbi5maWx0ZXItZXhwcmVzc2lvbi1zeW50YXggPiBkaXY6bGFzdC1jaGlsZCBvbCA+IGxpID4gbGFiZWwgeycsXG4nXHRcdHdpZHRoOiAxMDAlOycsXG4nXHRcdGZvbnQtd2VpZ2h0OiBub3JtYWw7JyxcbidcdFx0ZGlzcGxheTogaW5saW5lOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIC50YWJ6IC5maWx0ZXItdHJlZS13YXJuIHsnLFxuJ1x0XHRjb2xvcjogZGFya3JlZDsnLFxuJ1x0XHRmb250LXNpemU6IHNtYWxsZXI7JyxcbidcdFx0Zm9udC1zdHlsZTogaXRhbGljOycsXG4nXHRcdGxpbmUtaGVpZ2h0OiBpbml0aWFsOycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIC50YWJ6ID4gc2VjdGlvbi5maWx0ZXItZXhwcmVzc2lvbi1zeW50YXggPiB0ZXh0YXJlYSwnLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgLnRhYnogPiBzZWN0aW9uLmZpbHRlci1leHByZXNzaW9uLXN5bnRheCA+IGRpdjpsYXN0LWNoaWxkIHRleHRhcmVhLCcsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiA+IHNlY3Rpb24uZmlsdGVyLWV4cHJlc3Npb24tc3ludGF4ID4gZGl2Omxhc3QtY2hpbGQgaW5wdXQgeycsXG4nXHRcdGRpc3BsYXk6IGJsb2NrOycsXG4nXHRcdHBvc2l0aW9uOiByZWxhdGl2ZTsnLFxuJ1x0XHRtaW4td2lkdGg6IDEwMCU7JyxcbidcdFx0bWF4LXdpZHRoOiAxMDAlOycsXG4nXHRcdGJveC1zaXppbmc6IGJvcmRlci1ib3g7JyxcbidcdFx0Ym9yZGVyOiAxcHggc29saWQgYmxhY2s7JyxcbidcdFx0cGFkZGluZzogLjRlbSAuN2VtOycsXG4nXHRcdGZvbnQtZmFtaWx5OiBtb25vc3BhY2U7JyxcbidcdFx0Zm9udC1zaXplOiA5cHQ7JyxcbidcdFx0bWFyZ2luLXRvcDogM3B4OycsXG4nXHR9JyxcbidcdCNoeXBlcmdyaWQtZGlhbG9nIC50YWJ6ID4gc2VjdGlvbi5maWx0ZXItZXhwcmVzc2lvbi1zeW50YXggPiB0ZXh0YXJlYSB7JyxcbidcdFx0aGVpZ2h0OiA5NiU7JyxcbidcdH0nLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgLnRhYnogYS5maWx0ZXItY29weSB7JyxcbidcdFx0ZGlzcGxheTogYmxvY2s7JyxcbidcdFx0ZmxvYXQ6IHJpZ2h0OycsXG4nXHRcdGZvbnQtc2l6ZTogc21hbGxlcjsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiBhLmZpbHRlci1jb3B5OmJlZm9yZSB7JyxcbidcdFx0Y29udGVudDogXFwnKGNvcHlcXCc7JyxcbidcdH0nLFxuJ1x0I2h5cGVyZ3JpZC1kaWFsb2cgLnRhYnogYS5maWx0ZXItY29weTphZnRlciB7JyxcbidcdFx0Y29udGVudDogXFwnKVxcJzsnLFxuJ1x0fScsXG4nXHQjaHlwZXJncmlkLWRpYWxvZyAudGFieiBhLmZpbHRlci1jb3B5OmFjdGl2ZSB7JyxcbidcdFx0Y29sb3I6IHJlZDsnLFxuJ1x0fScsXG4nPC9zdHlsZT4nLFxuJycsXG4nPGRpdj4nLFxuJ1x0PHNlbGVjdCBpZD1cImFkZC1jb2x1bW4tZmlsdGVyLXN1YmV4cHJlc3Npb25cIiBzdHlsZT1cImZsb2F0OnJpZ2h0OyBtYXJnaW4tbGVmdDoxZW07IG1hcmdpbi1yaWdodDo0ZW07XCI+JyxcbidcdFx0PG9wdGlvbiB2YWx1ZT1cIlwiPk5ldyBjb2x1bW4gZmlsdGVyJmhlbGxpcDs8L29wdGlvbj4nLFxuJ1x0PC9zZWxlY3Q+JyxcbicnLFxuJ1x0PHA+JyxcbidcdFx0PHNwYW4+Q29sdW1uIEZpbHRlcnM8L3NwYW4+JyxcbidcdFx0PGEgY2xhc3M9XCJtb3JlLWluZm9cIj48L2E+JyxcbidcdDwvcD4nLFxuJ1x0PGRpdiBjbGFzcz1cIm1vcmUtaW5mb1wiPicsXG4nXHRcdDxwPlRoZSB0YWJsZSBmaWx0ZXIgY2FuIGJlIHZpZXdlZCBpbiB0aGUgUXVlcnkgQnVpbGRlciBvciBhcyBTUUwgV0hFUkUgY2xhdXNlIHN5bnRheC4gQm90aCBpbnRlcmZhY2VzIG1hbmlwdWxhdGUgdGhlIHNhbWUgdW5kZXJseWluZyBmaWx0ZXIgZGF0YSBzdHJ1Y3R1cmUuPC9wPicsXG4nXHRcdDxwPkFsbCBjb2x1bW4gZmlsdGVycyBhcmUgQU5EJnJzcXVvO2QgdG9nZXRoZXIuIEVhY2ggZ3JpZCByb3cgaXMgZmlyc3QgcXVhbGlmaWVkIGJ5IHRoZSB0YWJsZSBmaWx0ZXIgYW5kIHRoZW4gc3VjY2Vzc2l2ZWx5IHF1YWxpZmllZCBieSBlYWNoIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbi48L3A+JyxcbidcdDwvZGl2PicsXG4nJyxcbidcdDxkaXYgY2xhc3M9XCJ0YWJ6XCIgaWQ9XCJjb2x1bW5GaWx0ZXJzUGFuZWxcIj4nLFxuJycsXG4nXHRcdDxoZWFkZXIgaWQ9XCJjb2x1bW5zUUJcIiBjbGFzcz1cImRlZmF1bHQtdGFiXCI+JyxcbidcdFx0XHRRdWVyeSBCdWlsZGVyJyxcbidcdFx0PC9oZWFkZXI+JyxcbicnLFxuJ1x0XHQ8c2VjdGlvbj4nLFxuJ1x0XHQ8L3NlY3Rpb24+JyxcbicnLFxuJ1x0XHQ8aGVhZGVyIGlkPVwiY29sdW1uc1NRTFwiIGNsYXNzPVwidGFiei1iZzJcIj4nLFxuJ1x0XHRcdFNRTCcsXG4nXHRcdDwvaGVhZGVyPicsXG4nJyxcbidcdFx0PHNlY3Rpb24gY2xhc3M9XCJmaWx0ZXItZXhwcmVzc2lvbi1zeW50YXggdGFiei1iZzJcIj4nLFxuJ1x0XHRcdDxkaXY+JyxcbidcdFx0XHRcdDxwPicsXG4nXHRcdFx0XHRcdDxzcGFuPjwvc3Bhbj4nLFxuJ1x0XHRcdFx0XHQ8YSB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJmaWx0ZXItY29weVwiIHRpdGxlPVwiVGhlIHN0YXRlIG9mIHRoZSBjb2x1bW4gZmlsdGVycyBzdWJ0cmVlIGV4cHJlc3NlZCBpbiBTUUwgc3ludGF4IChhbGwgdGhlIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbnMgc2hvd24gYmVsb3cgQU5EJnJzcXVvO2QgdG9nZXRoZXIpLlwiPicsXG4nXHRcdFx0XHRcdFx0YWxsPC9hPicsXG4nXHRcdFx0XHQ8L3A+JyxcbidcdFx0XHRcdDxvbD48L29sPicsXG4nXHRcdFx0PC9kaXY+JyxcbidcdFx0PC9zZWN0aW9uPicsXG4nJyxcbidcdFx0PGhlYWRlciBpZD1cImNvbHVtbnNDUUxcIiBjbGFzcz1cInRhYnotYmcxXCI+JyxcbidcdFx0XHRDUUwnLFxuJ1x0XHQ8L2hlYWRlcj4nLFxuJycsXG4nXHRcdDxzZWN0aW9uIGNsYXNzPVwiZmlsdGVyLWV4cHJlc3Npb24tc3ludGF4IHRhYnotYmcxXCI+JyxcbidcdFx0XHQ8cD4nLFxuJ1x0XHRcdFx0PGVtPicsXG4nXHRcdFx0XHRcdDxzbWFsbD5Db2x1bW4gZmlsdGVyIGNlbGxzIGFjY2VwdCBhIHNpbXBsaWZpZWQsIGNvbXBhY3QsIGFuZCBpbnR1aXRpdmUgc3ludGF4LCB3aGljaCBpcyBob3dldmVyIG5vdCBhcyBmbGV4aWJsZSBvciBjb25jaXNlIGFzIFNRTCBzeW50YXggb3IgdXNpbmcgdGhlIFF1ZXJ5IEJ1aWxkZXIuPC9zbWFsbD4nLFxuJ1x0XHRcdFx0XHQ8YSBjbGFzcz1cIm1vcmUtaW5mb1wiPjwvYT4nLFxuJ1x0XHRcdFx0PC9lbT4nLFxuJ1x0XHRcdDwvcD4nLFxuJ1x0XHRcdDxkaXYgY2xhc3M9XCJtb3JlLWluZm9cIj4nLFxuJ1x0XHRcdFx0PHVsPicsXG4nXHRcdFx0XHRcdDxsaT4nLFxuJ1x0XHRcdFx0XHRcdFNpbXBsZSBleHByZXNzaW9ucycsXG4nXHRcdFx0XHRcdFx0PHVsPicsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+QWxsIHNpbXBsZSBleHByZXNzaW9ucyB0YWtlIHRoZSBmb3JtIDxpPm9wZXJhdG9yIGxpdGVyYWw8L2k+IG9yIDxpPm9wZXJhdG9yIGlkZW50aWZpZXI8L2k+LiBUaGUgKGxlZnQgc2lkZSkgY29sdW1uIGlzIGFsd2F5cyBpbXBsaWVkIGFuZCBpcyB0aGUgc2FtZSBmb3IgYWxsIHNpbXBsZSBleHByZXNzaW9ucyBpbiBhIGNvbXBvdW5kIGV4cHJlc3Npb24uIFRoaXMgaXMgYmVjYXVzZSBjb2x1bW4gZmlsdGVycyBhcmUgYWx3YXlzIHRpZWQgdG8gYSBrbm93biBjb2x1bW4uPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+SWYgdGhlIG9wZXJhdG9yIGlzIGFuIGVxdWFscyBzaWduICg9KSwgaXQgbWF5IGJlIG9taXR0ZWQuPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+QmVzaWRlcyBvcGVyYXRvcnMsIG5vIG90aGVyIHB1bmN0dWF0aW9uIGlzIHBlcm1pdHRlZCwgbWVhbmluZyB0aGF0IG5vIHF1b3RhdGlvbiBtYXJrcyBhbmQgbm8gcGFyZW50aGVzZXMuPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+SWYgYSBsaXRlcmFsIGV4YWN0bHkgbWF0Y2hlcyBhIGNvbHVtbiBuYW1lIG9yIGFsaWFzLCB0aGUgb3BlcmFuZCBpcyBub3QgdGFrZW4gbGl0ZXJhbGx5IGFuZCBpbnN0ZWFkIHJlZmVycyB0byB0aGUgdmFsdWUgaW4gdGhhdCBjb2x1bW4uIChUaGVyZSBhcmUgcHJvcGVydGllcyB0byBjb250cm9sIHdoYXQgY29uc3RpdHV0ZXMgc3VjaCBhIG1hdGNoOiBDb2x1bW4gbmFtZSwgYWxpYXMsIG9yIGVpdGhlcjsgYW5kIHRoZSBjYXNlLXNlbnNpdGl2aXR5IG9mIHRoZSBtYXRjaC4pPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+QXMgbGl0ZXJhbHMgYXJlIHVucXVvdGVkLCBhbnkgb3BlcmF0b3Igc3ltYm9sIG9yIG9wZXJhdG9yIHdvcmQgKGluY2x1ZGluZyBsb2dpY2FsIG9wZXJhdG9ycyBmb3IgY29tcG91bmQgZXhwcmVzc2lvbnMpIHRlcm1pbmF0ZXMgYSBsaXRlcmFsLjwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdFx0PGxpPkFuIGltcG9ydGFudCBjb3JvbGxhcnkgdG8gdGhlIGFib3ZlIGZlYXR1cmVzIGlzIHRoYXQgb3BlcmF0b3JzIG1heSBub3QgYXBwZWFyIGluIGxpdGVyYWxzLjwvbGk+JyxcbidcdFx0XHRcdFx0XHQ8L3VsPicsXG4nXHRcdFx0XHRcdDwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHQ8bGk+JyxcbidcdFx0XHRcdFx0XHRDb21wb3VuZCBleHByZXNzaW9ucycsXG4nXHRcdFx0XHRcdFx0PHVsPicsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+Q29tcG91bmQgZXhwcmVzc2lvbnMgYXJlIGZvcm1lZCBieSBjb25uZWN0aW5nIHNpbXBsZSBleHByZXNzaW9ucyB3aXRoIHRoZSBsb2dpY2FsIG9wZXJhdG9ycyA8Y29kZT5BTkQ8L2NvZGU+LCA8Y29kZT5PUjwvY29kZT4sIDxjb2RlPk5PUjwvY29kZT4sIG9yIDxjb2RlPk5BTkQ8L2NvZGU+IChcIm5vdCBhbmRcIikuPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHQ8bGk+SG93ZXZlciwgYWxsIGxvZ2ljYWwgb3BlcmF0b3JzIHVzZWQgaW4gYSBjb21wb3VuZCBjb2x1bW4gZmlsdGVyIGV4cHJlc3Npb24gbXVzdCBiZSBob21vZ2VuZW91cy4gWW91IG1heSBub3QgbWl4IHRoZSBhYm92ZSBsb2dpY2FsIG9wZXJhdG9ycyBpbiBhIHNpbmdsZSBjb2x1bW4uIChJZiB5b3UgbmVlZCB0byBkbyB0aGlzLCBjcmVhdGUgYSB0YWJsZSBmaWx0ZXIgZXhwcmVzc2lvbiBpbnN0ZWFkLik8L2xpPicsXG4nXHRcdFx0XHRcdFx0PC91bD4nLFxuJ1x0XHRcdFx0XHQ8L2xpPicsXG4nJyxcbidcdFx0XHRcdFx0PGxpPicsXG4nXHRcdFx0XHRcdFx0SGlkZGVuIGxvZ2ljJyxcbidcdFx0XHRcdFx0XHQ8dWw+JyxcbidcdFx0XHRcdFx0XHRcdDxsaT5JZiB0aGUgY29sdW1uIGlzIGFsc28gcmVmZXJlbmNlZCBpbiBhIHRhYmxlIGZpbHRlciBleHByZXNzaW9uIChvbiB0aGUgbGVmdCBzaWRlIG9mIGEgc2ltcGxlIGV4cHJlc3Npb24pLCB0aGUgY29sdW1uIGZpbHRlciBpcyBmbGFnZ2VkIGluIGl0cyBncmlkIGNlbGwgd2l0aCBhIHNwZWNpYWwgc3RhciBjaGFyYWN0ZXIuIFRoaXMgaXMganVzdCBhIGZsYWc7IGl0IGlzIG5vdCBwYXJ0IG9mIHRoZSBzeW50YXguIDxzcGFuIHN0eWxlPVwiY29sb3I6cmVkOyBmb250LXN0eWxlOml0YWxpY1wiPk5vdCB5ZXQgaW1wbGVtZW50ZWQuPC9zcGFuPjwvbGk+JyxcbidcdFx0XHRcdFx0XHQ8L3VsPicsXG4nXHRcdFx0XHRcdDwvbGk+JyxcbidcdFx0XHRcdDwvdWw+JyxcbidcdFx0XHQ8L2Rpdj4nLFxuJycsXG4nXHRcdFx0PGRpdj4nLFxuJ1x0XHRcdFx0PHA+PHNwYW4+PC9zcGFuPjwvcD4nLFxuJ1x0XHRcdFx0PG9sPjwvb2w+JyxcbidcdFx0XHQ8L2Rpdj4nLFxuJ1x0XHQ8L3NlY3Rpb24+JyxcbidcdDwvZGl2PicsXG4nPC9kaXY+JyxcbicnLFxuJzxkaXY+JyxcbidcdDxwPicsXG4nXHRcdDxzcGFuPlRhYmxlIEZpbHRlcjwvc3Bhbj4nLFxuJ1x0XHQ8YSBjbGFzcz1cIm1vcmUtaW5mb1wiPjwvYT4nLFxuJ1x0PC9wPicsXG4nXHQ8ZGl2IGNsYXNzPVwibW9yZS1pbmZvXCI+JyxcbidcdFx0PHA+VGhlIHRhYmxlIGZpbHRlciBjYW4gYmUgdmlld2VkIGluIHRoZSBRdWVyeSBCdWlsZGVyIG9yIGFzIFNRTCBXSEVSRSBjbGF1c2Ugc3ludGF4LiBCb3RoIGludGVyZmFjZXMgbWFuaXB1bGF0ZSB0aGUgc2FtZSB1bmRlcmx5aW5nIGZpbHRlciBkYXRhIHN0cnVjdHVyZS48L3A+JyxcbidcdFx0PHA+JyxcbidcdFx0XHRUaGVzZSBmaWx0ZXIgc3ViZXhwcmVzc2lvbnMgYXJlIGJvdGggcmVxdWlyZWQgKDxjb2RlPkFORDwvY29kZT4mcnNxdW87ZCB0b2dldGhlciksIHJlc3VsdGluZyBpbiBhIHN1YnNldCBvZiA8ZW0+cXVhbGlmaWVkIHJvd3M8L2VtPiB3aGljaCBoYXZlIHBhc3NlZCB0aHJvdWdoIGJvdGggZmlsdGVycy4nLFxuJ1x0XHRcdEl0XFwncyBjYWxsZWQgYSA8ZGZuPnRyZWU8L2Rmbj4gYmVjYXVzZSBpdCBjb250YWlucyBib3RoIDxkZm4+YnJhbmNoZXM8L2Rmbj4gYW5kIDxkZm4+bGVhdmVzPC9kZm4+LicsXG4nXHRcdFx0VGhlIGxlYXZlcyByZXByZXNlbnQgPGRmbj5jb25kaXRpb25hbCBleHByZXNzaW9uczwvZGZuPiAob3Igc2ltcGx5IDxkZm4+Y29uZGl0aW9uYWxzPC9kZm4+KS4nLFxuJ1x0XHRcdFRoZSBicmFuY2hlcywgYWxzbyBrbm93biBhcyA8ZGZuPnN1YnRyZWVzPC9kZm4+LCBjb250YWluIGxlYXZlcyBhbmQvb3Igb3RoZXIgYnJhbmNoZXMgYW5kIHJlcHJlc2VudCBzdWJleHByZXNzaW9ucyB0aGF0IGdyb3VwIGNvbmRpdGlvbmFscyB0b2dldGhlci4nLFxuJ1x0XHRcdEdyb3VwZWQgY29uZGl0aW9uYWxzIGFyZSBldmFsdWF0ZWQgdG9nZXRoZXIsIGJlZm9yZSBjb25kaXRpb25hbHMgb3V0c2lkZSB0aGUgZ3JvdXAuJyxcbidcdFx0PC9wPicsXG4nXHQ8L2Rpdj4nLFxuJycsXG4nXHQ8ZGl2IGNsYXNzPVwidGFielwiIGlkPVwidGFibGVGaWx0ZXJQYW5lbFwiPicsXG4nXHRcdDxoZWFkZXIgaWQ9XCJ0YWJsZVFCXCI+JyxcbidcdFx0XHRRdWVyeSBCdWlsZGVyJyxcbidcdFx0PC9oZWFkZXI+JyxcbicnLFxuJ1x0XHQ8c2VjdGlvbj4nLFxuJ1x0XHQ8L3NlY3Rpb24+JyxcbicnLFxuJ1x0XHQ8aGVhZGVyIGlkPVwidGFibGVTUUxcIiBjbGFzcz1cInRhYnotYmcyXCI+JyxcbidcdFx0XHRTUUwnLFxuJ1x0XHQ8L2hlYWRlcj4nLFxuJycsXG4nXHRcdDxzZWN0aW9uIGNsYXNzPVwiZmlsdGVyLWV4cHJlc3Npb24tc3ludGF4IHRhYnotYmcyXCI+JyxcbidcdFx0XHQ8ZGl2PicsXG4nXHRcdFx0XHQ8cD4nLFxuJ1x0XHRcdFx0XHRTUUwgV0hFUkUgY2xhdXNlIHN5bnRheCB3aXRoIGNlcnRhaW4gcmVzdHJpY3Rpb25zLicsXG4nXHRcdFx0XHRcdDxhIGNsYXNzPVwibW9yZS1pbmZvXCI+PC9hPicsXG4nXHRcdFx0XHQ8L3A+JyxcbidcdFx0XHRcdDxkaXYgY2xhc3M9XCJtb3JlLWluZm9cIj4nLFxuJ1x0XHRcdFx0XHQ8dWw+JyxcbidcdFx0XHRcdFx0XHQ8bGk+JyxcbidcdFx0XHRcdFx0XHRcdFNpbXBsZSBleHByZXNzaW9ucycsXG4nXHRcdFx0XHRcdFx0XHQ8dWw+JyxcbidcdFx0XHRcdFx0XHRcdFx0PGxpPkFsbCBzaW1wbGUgZXhwcmVzc2lvbnMgbXVzdCBiZSBvZiB0aGUgZm9ybSA8aT5jb2x1bW4gb3BlcmF0b3IgbGl0ZXJhbDwvaT4gb3IgPGk+Y29sdW1uIG9wZXJhdG9yIGlkZW50aWZpZXI8L2k+LiBUaGF0IGlzLCB0aGUgbGVmdCBzaWRlIG11c3QgcmVmZXIgdG8gYSBjb2x1bW4gKG1heSBub3QgYmUgYSBsaXRlcmFsKTsgd2hlcmVhcyB0aGUgcmlnaHQgc2lkZSBtYXkgYmUgZWl0aGVyLjwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdFx0XHQ8bGk+Q29sdW1uIG5hbWVzIG1heSBiZSBxdW90ZWQgd2l0aCB0aGUgY3VycmVudGx5IHNldCBxdW90ZSBjaGFyYWN0ZXJzICh0eXBpY2FsbHkgZG91YmxlLXF1b3RlcykuIElmIHVucXVvdGVkLCB0aGV5IG11c3QgY29uc2lzdCBvZiBjbGFzc2ljIGlkZW50aWZpZXIgc3ludGF4IChhbHBoYW51bWVyaWNzIGFuZCB1bmRlcnNjb3JlLCBidXQgbm90IGJlZ2lubmluZyB3aXRoIGEgbnVtZXJhbCkuPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHRcdDxsaT5BbGwgbGl0ZXJhbHMgbXVzdCBiZSBxdW90ZWQgc3RyaW5ncyAodXNpbmcgc2luZ2xlIHF1b3RlcykuIChJbiBhIGZ1dHVyZSByZWxlYXNlIHdlIGV4cGVjdCB0byBzdXBwb3J0IHVucXVvdGVkIG51bWVyaWMgc3ludGF4IGZvciBjb2x1bW5zIGV4cGxpY2l0bHkgdHlwZWQgYXMgbnVtZXJpYy4pPC9saT4nLFxuJ1x0XHRcdFx0XHRcdFx0PC91bD4nLFxuJ1x0XHRcdFx0XHRcdDwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdDxsaT4nLFxuJ1x0XHRcdFx0XHRcdFx0Q29tcG91bmQgZXhwcmVzc2lvbnMnLFxuJ1x0XHRcdFx0XHRcdFx0PHVsPicsXG4nXHRcdFx0XHRcdFx0XHRcdDxsaT5Db21wb3VuZCBleHByZXNzaW9ucyBhcmUgZm9ybWVkIGJ5IGNvbm5lY3Rpbmcgc2ltcGxlIGV4cHJlc3Npb25zIHdpdGggdGhlIGxvZ2ljYWwgb3BlcmF0b3JzIDxjb2RlPkFORDwvY29kZT4gb3IgPGNvZGU+T1I8L2NvZGU+LjwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdFx0XHQ8bGk+SG93ZXZlciwgYWxsIGxvZ2ljYWwgb3BlcmF0b3JzIGF0IGVhY2ggbGV2ZWwgaW4gYSBjb21wbGV4IGV4cHJlc3Npb24gKGVhY2ggcGFyZW50aGVzaXplZCBzdWJleHByZXNzaW9uKSBtdXN0IGJlIGhvbW9nZW5lb3VzLCA8aT5pLmUuLDwvaT4gZWl0aGVyIDxjb2RlPkFORDwvY29kZT4gb3IgPGNvZGU+T1I8L2NvZGU+IGJ1dCBub3QgYSBtaXh0dXJlIG9mIHRoZSB0d28uIEluIG90aGVyIHdvcmRzLCB0aGVyZSBpcyBubyBpbXBsaWNpdCBvcGVyYXRvciBwcmVjZWRlbmNlOyBncm91cGluZyBvZiBleHByZXNzaW9ucyBtdXN0IGFsd2F5cyBiZSBleHBsaWNpdGx5IHN0YXRlZCB3aXRoIHBhcmVudGhlc2VzLjwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdFx0XHQ8bGk+VGhlIHVuYXJ5IGxvZ2ljYWwgb3BlcmF0b3IgPGNvZGU+Tk9UPC9jb2RlPiBpcyBzdXBvb3J0ZWQgYmVmb3JlIHBhcmVudGhlc2VzIG9ubHkuIFdoaWxlIHRoZSBRdWVyeSBCdWlsZGVyIGFuZCB0aGUgQ29sdW1uIEZpbHRlciBhbGxvdyB0aGV5IHN5bnRheCA8Y29kZT4maGVsbGlwOyBOT1QgPGk+b3BlcmF0b3I8L2k+ICZoZWxsaXA7PC9jb2RlPiAod2hlcmUgPGNvZGU+PGk+b3BlcmF0b3I8L2k+PC9jb2RlPiBpcyA8Y29kZT5JTjwvY29kZT4sIDxjb2RlPkxJS0U8L2NvZGU+LCA8aT5ldGMuPC9pPiksIHRoZXNlIG11c3QgYmUgZXhwcmVzc2VkIGhlcmUgd2l0aCBwYXJlbnRoZXRoZXM6IDxjb2RlPk5PVCAoJmhlbGxpcDsgPGk+b3BlcmF0b3I8L2k+ICZoZWxsaXA7KTwvY29kZT4uPC9saT4nLFxuJycsXG4nXHRcdFx0XHRcdFx0XHRcdDxsaT5XaGlsZSB0aGUgUXVlcnkgQnVpbGRlciBhbmQgQ29sdW1uIEZpbHRlciBzeW50YXggc3VwcG9ydCB0aGUgcHNldWRvLW9wZXJhdG9ycyA8Y29kZT5OT1I8L2NvZGU+IGFuZCA8Y29kZT5OQU5EPC9jb2RlPiwgaW4gU1FMIHRoZXNlIG11c3QgYmUgZXhwcmVzc2VkIGFzIDxjb2RlPk5PVCAoJmhlbGxpcDsgT1IgJmhlbGxpcDspPC9jb2RlPiBhbmQgPGNvZGU+Tk9UICgmaGVsbGlwOyBBTkQgJmhlbGxpcDspPC9jb2RlPiwgcmVzcGVjdGl2ZWx5LjwvbGk+JyxcbicnLFxuJ1x0XHRcdFx0XHRcdFx0XHQ8bGk+VGhlIFF1ZXJ5IEJ1aWxkZXIgYW5kIENvbHVtbiBGaWx0ZXIgc3ludGF4IGFsc28gc3VwcG9ydCB0aGUgcHNldWRvLW9wZXJhdG9ycyA8Y29kZT5CRUdJTlMgYWJjPC9jb2RlPiwgPGNvZGU+RU5EUyB4eXo8L2NvZGU+LCBhbmQgPGNvZGU+Q09OVEFJTlMgZGVmPC9jb2RlPi4gVGhlc2UgYXJlIGV4cHJlc3NlZCBpbiBTUUwgYnkgPGNvZGU+TElLRSBcXCdhYmMlXFwnPC9jb2RlPiwgPGNvZGU+TElLRSBcXCcleHl6XFwnPC9jb2RlPiwgYW5kIDxjb2RlPkxJS0UgXFwnJWRlZiVcXCc8L2NvZGU+LCByZXNwZWN0aXZlbHkuPC9saT4nLFxuJ1x0XHRcdFx0XHRcdFx0PC91bD4nLFxuJ1x0XHRcdFx0XHRcdDwvbGk+JyxcbidcdFx0XHRcdFx0PC91bD4nLFxuJ1x0XHRcdFx0PC9kaXY+JyxcbidcdFx0XHQ8L2Rpdj4nLFxuJ1x0XHRcdDxkaXYgY2xhc3M9XCJmaWx0ZXItdHJlZS13YXJuXCI+PC9kaXY+JyxcbidcdFx0XHQ8dGV4dGFyZWE+PC90ZXh0YXJlYT4nLFxuJ1x0XHQ8L3NlY3Rpb24+JyxcbicnLFxuJ1x0PC9kaXY+Jyxcbic8L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGRpYWxvZ3MgPSByZXF1aXJlKCcuLi9kaWFsb2dzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8qKlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKiBAZGVzYyBkZWxlZ2F0ZSBoYW5kbGluZyBkb3VibGUgY2xpY2sgdG8gdGhlIGZlYXR1cmUgY2hhaW4gb2YgcmVzcG9uc2liaWxpdHlcbiAgICAgKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFtvcHRpb25zXSAtIEZvcndhcmRlZCB0byBkaWFsb2cgY29uc3RydWN0b3IuXG4gICAgICovXG4gICAgb3BlbkRpYWxvZzogZnVuY3Rpb24oZGlhbG9nTmFtZSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IGRpYWxvZ3NbZGlhbG9nTmFtZV0odGhpcy5ncmlkLCBvcHRpb25zKTtcbiAgICB9XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZWRpdG9yQWN0aXZhdGlvbktleXMgPSBbJ2FsdCcsICdlc2MnXTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7IC8vIGZ5aTogaW5zdGFsbHMgdGhlIEFycmF5LnByb3RvdHlwZS5maW5kIHBvbHlmaWxsLCBhcyBuZWVkZWRcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTdGlja3kgaGFzaCBvZiBkaWFsb2cgb3B0aW9ucyBvYmplY3RzLlxuICAgICAqIEBkZXNjIEVhY2gga2V5IGlzIGEgZGlhbG9nIG5hbWU7IHRoZSB2YWx1ZSBpcyB0aGUgb3B0aW9ucyBvYmplY3QgZm9yIHRoYXQgZGlhbG9nLlxuICAgICAqIFRoZSBkZWZhdWx0IGRpYWxvZyBvcHRpb25zIG9iamVjdCBoYXMgdGhlIGtleSBgJ3VuZGVmaW5lZCdgLCB3aGljaCBpcyB1bmRlZmluZWQgYnkgZGVmYXVsdDsgaXQgaXMgc2V0IGJ5IGNhbGxpbmcgYHNldERpYWxvZ09wdGlvbnNgIHdpdGggbm8gYGRpYWxvZ05hbWVgIHBhcmFtZXRlci5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGRpYWxvZ09wdGlvbnM6IHt9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGFuZC9vciByZXR1cm4gYSBzcGVjaWZpYyBkaWFsb2cgb3B0aW9ucyBvYmplY3QgKm9yKiBhIGRlZmF1bHQgZGlhbG9nIG9wdGlvbnMgb2JqZWN0LlxuICAgICAqXG4gICAgICogQGRlc2MgSWYgYG9wdGlvbnNgIGRlZmluZWQ6XG4gICAgICogKiBJZiBgZGlhbG9nTmFtZWAgZGVmaW5lZDogU2F2ZSB0aGUgc3BlY2lmaWMgZGlhbG9nJ3Mgb3B0aW9ucyBvYmplY3QuXG4gICAgICogKiBJZiBgZGlhbG9nTmFtZWAgdW5kZWZpbmVkOiBTYXZlIHRoZSBkZWZhdWx0IGRpYWxvZyBvcHRpb25zIG9iamVjdC5cbiAgICAgKlxuICAgICAqIElmIGBvcHRpb25zYCBpcyBfbm90XyBkZWZpbmVkLCBubyBuZXcgZGlhbG9nIG9wdGlvbnMgb2JqZWN0IHdpbGwgYmUgc2F2ZWQ7IGJ1dCBhIHByZXZpb3VzbHkgc2F2ZWQgcHJlc2V0IHdpbGwgYmUgcmV0dXJuZWQgKGFmdGVyIG1peGluZyBpbiB0aGUgZGVmYXVsdCBwcmVzZXQgaWYgdGhlcmUgaXMgb25lKS5cbiAgICAgKlxuICAgICAqIFRoZSBkZWZhdWx0IGRpYWxvZyBvcHRpb25zIG9iamVjdCBpcyB1c2VkIGluIHR3byB3YXlzOlxuICAgICAqICogd2hlbiBhIGRpYWxvZyBoYXMgbm8gb3B0aW9ucyBvYmplY3RcbiAgICAgKiAqIGFzIGEgbWl4LWluIGJhc2Ugd2hlbiBhIGRpYWxvZyBkb2VzIGhhdmUgYW4gb3B0aW9ucyBvYmplY3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGlhbG9nTmFtZV0gSWYgdW5kZWZpbmVkLCBgb3B0aW9uc2AgZGVmaW5lcyB0aGUgZGVmYXVsdCBkaWFsb2cgb3B0aW9ucyBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIElmIGRlZmluZWQsIHByZXNldCB0aGUgbmFtZWQgZGlhbG9nIG9wdGlvbnMgb2JqZWN0IG9yIHRoZSBkZWZhdWx0IGRpYWxvZyBvcHRpb25zIG9iamVjdCBpZiBuYW1lIGlzIHVuZGVmaW5lZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IE9uZSBvZjpcbiAgICAgKiAqIFdoZW4gYG9wdGlvbnNgIHVuZGVmaW5lZCwgZmlyc3Qgb2Y6XG4gICAgICogICAqIHByZXZpb3VzIHByZXNldFxuICAgICAqICAgKiBkZWZhdWx0IHByZXNldFxuICAgICAqICAgKiBlbXB0eSBvYmplY3RcbiAgICAgKiAqIFdoZW4gYG9wdGlvbnNgIGRlZmluZWQsIGZpcnN0IG9mOlxuICAgICAqICAgKiBtaXgtaW46IGRlZmF1bHQgcHJlc2V0IG1lbWJlcnMgKyBgb3B0aW9uc2AgbWVtYmVyc1xuICAgICAqICAgKiBgb3B0aW9uc2AgdmVyYmF0aW0gd2hlbiBkZWZhdWx0IHByZXNldCB1bmRlZmluZWRcbiAgICAgKi9cbiAgICBzZXREaWFsb2dPcHRpb25zOiBmdW5jdGlvbihkaWFsb2dOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZGlhbG9nTmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBkaWFsb2dOYW1lO1xuICAgICAgICAgICAgZGlhbG9nTmFtZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB0aGlzLmRpYWxvZ09wdGlvbnMudW5kZWZpbmVkO1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBkaWFsb2dOYW1lICYmIHRoaXMuZGlhbG9nT3B0aW9uc1tkaWFsb2dOYW1lXTtcbiAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHRoaXMuZGlhbG9nT3B0aW9uc1tkaWFsb2dOYW1lXSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAoZGVmYXVsdE9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0gXyh7fSkuZXh0ZW5kKGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTsgLy8gbWFrZSBhIG1peC1pblxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zIHx8IHt9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBPcHRpb25zIG9iamVjdHMgYXJlIHJlbWVtYmVyZWQgZm9yIHN1YnNlcXVlbnQgdXNlLiBBbHRlcm5hdGl2ZWx5LCB0aGV5IGNhbiBiZSBwcmVzZXQgYnkgY2FsbGluZyB7QGxpbmsgSHlwZXJncmlkI3NldERpYWxvZ09wdGlvbnN8c2V0RGlhbG9nT3B0aW9uc30uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGRpYWxvZ05hbWVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gSWYgb21pdHRlZCwgdXNlIHRoZSBvcHRpb25zIG9iamVjdCBwcmV2aW91c2x5IGdpdmVuIGhlcmUgKG9yIHRvIHtAbGluayBIeXBlcmdyaWQjc2V0RGlhbG9nT3B0aW9uc3xzZXREaWFsb2dPcHRpb25zfSksIGlmIGFueS4gSW4gYW55IGNhc2UsIHRoZSByZXN1bHRhbnQgb3B0aW9ucyBvYmplY3QsIGlmIGFueSwgaXMgbWl4ZWQgaW50byB0aGUgZGVmYXVsdCBvcHRpb25zIG9iamVjdCwgaWYgdGhlcmUgaXMgb25lLlxuICAgICAqL1xuICAgIG9wZW5EaWFsb2c6IGZ1bmN0aW9uKGRpYWxvZ05hbWUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5zdG9wRWRpdGluZygpO1xuICAgICAgICBvcHRpb25zID0gdGhpcy5zZXREaWFsb2dPcHRpb25zKGRpYWxvZ05hbWUsIG9wdGlvbnMpO1xuICAgICAgICBvcHRpb25zLnRlcm1pbmF0ZSA9IGZ1bmN0aW9uKCkgeyAvLyB3aGVuIGFib3V0LXRvLWJlLW9wZW5lZCBkaWFsb2cgaXMgZXZlbnR1YWxseSBjbG9zZWRcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmRpYWxvZztcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLmRpYWxvZyA9IHRoaXMuYmVoYXZpb3Iub3BlbkRpYWxvZyhkaWFsb2dOYW1lLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5hbGxvd0V2ZW50cyhmYWxzZSk7XG4gICAgfSxcblxuICAgIC8vIGFsdGhvdWdoIHlvdSBjYW4gaGF2ZSBtdWx0aXBsZSBkaWFsb2dzIG9wZW4gYXQgdGhlIHNhbWUgdGltZSwgdGhlIGZvbGxvd2luZyBlbmZvcmNlcyBvbmUgYXQgYSB0aW1lIChmb3Igbm93KVxuICAgIHRvZ2dsZURpYWxvZzogZnVuY3Rpb24obmV3RGlhbG9nTmFtZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgZGlhbG9nID0gdGhpcy5kaWFsb2csXG4gICAgICAgICAgICBvbGREaWFsb2dOYW1lID0gZGlhbG9nICYmIGRpYWxvZy4kJENMQVNTX05BTUU7XG4gICAgICAgIGlmICghZGlhbG9nIHx8ICF0aGlzLmRpYWxvZy5jbG9zZSgpICYmIG9sZERpYWxvZ05hbWUgIT09IG5ld0RpYWxvZ05hbWUpIHtcbiAgICAgICAgICAgIGlmICghZGlhbG9nKSB7XG4gICAgICAgICAgICAgICAgLy8gb3BlbiBuZXcgZGlhbG9nIG5vd1xuICAgICAgICAgICAgICAgIHRoaXMub3BlbkRpYWxvZyhuZXdEaWFsb2dOYW1lLCBvcHRpb25zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gb3BlbiBuZXcgZGlhbG9nIHdoZW4gYWxyZWFkeS1vcGVuZWQgZGlhbG9nIGZpbmlzaGVzIGNsb3NpbmcgZHVlIHRvIC5jbG9zZURpYWxvZygpIGFib3ZlXG4gICAgICAgICAgICAgICAgZGlhbG9nLnRlcm1pbmF0ZSA9IHRoaXMub3BlbkRpYWxvZy5iaW5kKHRoaXMsIG5ld0RpYWxvZ05hbWUsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYWxsb3dFdmVudHModHJ1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy50YWtlRm9jdXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxufTtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKiBAbW9kdWxlIGF1dG9tYXQgKi9cblxudmFyIEVOQ09ERVJTID0gLyVcXHsoXFxkKylcXH0vZzsgLy8gZG91YmxlICQkIHRvIGVuY29kZVxuXG52YXIgUkVQTEFDRVJTID0gL1xcJFxceyguKj8pXFx9L2c7IC8vIHNpbmdsZSAkIHRvIHJlcGxhY2VcblxuXG4vKipcbiAqIEBzdW1tYXJ5IFN0cmluZyBmb3JtYXR0ZXIuXG4gKlxuICogQGRlc2MgU3RyaW5nIHN1YnN0aXR1dGlvbiBpcyBwZXJmb3JtZWQgb24gbnVtYmVyZWQgX3JlcGxhY2VyXyBwYXR0ZXJucyBsaWtlIGAke259YCBvciBfZW5jb2Rlcl8gcGF0dGVybnMgbGlrZSBgJXtufWAgd2hlcmUgbiBpcyB0aGUgemVyby1iYXNlZCBgYXJndW1lbnRzYCBpbmRleC4gU28gYCR7MH1gIHdvdWxkIGJlIHJlcGxhY2VkIHdpdGggdGhlIGZpcnN0IGFyZ3VtZW50IGZvbGxvd2luZyBgdGV4dGAuXG4gKlxuICogRW5jb2RlcnMgYXJlIGp1c3QgbGlrZSByZXBsYWNlcnMgZXhjZXB0IHRoZSBhcmd1bWVudCBpcyBIVE1MLWVuY29kZWQgYmVmb3JlIGJlaW5nIHVzZWQuXG4gKlxuICogVG8gY2hhbmdlIHRoZSBmb3JtYXQgcGF0dGVybnMsIGFzc2lnbiBuZXcgYFJlZ0V4cGAgcGF0dGVybnMgdG8gYGF1dG9tYXQuZW5jb2RlcnNgIGFuZCBgYXV0b21hdC5yZXBsYWNlcnNgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfGZ1bmN0aW9ufSB0ZW1wbGF0ZSAtIEEgdGVtcGxhdGUgdG8gYmUgZm9ybWF0dGVkIGFzIGRlc2NyaWJlZCBhYm92ZS4gT3ZlcmxvYWRzOlxuICogKiBBIHN0cmluZyBwcmltaXRpdmUgY29udGFpbmluZyB0aGUgdGVtcGxhdGUuXG4gKiAqIEEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggYHRoaXNgIGFzIHRoZSBjYWxsaW5nIGNvbnRleHQuIFRoZSB0ZW1wbGF0ZSBpcyB0aGUgdmFsdWUgcmV0dXJuZWQgZnJvbSB0aGlzIGNhbGwuXG4gKlxuICogQHBhcmFtIHsuLi4qfSBbcmVwbGFjZW1lbnRzXSAtIFJlcGxhY2VtZW50IHZhbHVlcyBmb3IgbnVtYmVyZWQgZm9ybWF0IHBhdHRlcm5zLlxuICpcbiAqIEByZXR1cm4ge3N0cmluZ30gVGhlIGZvcm1hdHRlZCB0ZXh0LlxuICpcbiAqIEBtZW1iZXJPZiBtb2R1bGU6YXV0b21hdFxuICovXG5mdW5jdGlvbiBhdXRvbWF0KHRlbXBsYXRlLCByZXBsYWNlbWVudHMvKi4uLiovKSB7XG4gICAgdmFyIGhhc1JlcGxhY2VtZW50cyA9IGFyZ3VtZW50cy5sZW5ndGggPiAxO1xuXG4gICAgLy8gaWYgYHRlbXBsYXRlYCBpcyBhIGZ1bmN0aW9uLCBjb252ZXJ0IGl0IHRvIHRleHRcbiAgICBpZiAodHlwZW9mIHRlbXBsYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUuY2FsbCh0aGlzKTsgLy8gbm9uLXRlbXBsYXRlIGZ1bmN0aW9uOiBjYWxsIGl0IHdpdGggY29udGV4dCBhbmQgdXNlIHJldHVybiB2YWx1ZVxuICAgIH1cblxuICAgIGlmIChoYXNSZXBsYWNlbWVudHMpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgIHRlbXBsYXRlID0gdGVtcGxhdGUucmVwbGFjZShhdXRvbWF0LnJlcGxhY2Vyc1JlZ2V4LCBmdW5jdGlvbihtYXRjaCwga2V5KSB7XG4gICAgICAgICAgICBrZXkgLT0gLTE7IC8vIGNvbnZlcnQgdG8gbnVtYmVyIGFuZCBpbmNyZW1lbnRcbiAgICAgICAgICAgIHJldHVybiBhcmdzLmxlbmd0aCA+IGtleSA/IGFyZ3Nba2V5XSA6ICcnO1xuICAgICAgICB9KTtcblxuICAgICAgICB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoYXV0b21hdC5lbmNvZGVyc1JlZ2V4LCBmdW5jdGlvbihtYXRjaCwga2V5KSB7XG4gICAgICAgICAgICBrZXkgLT0gLTE7IC8vIGNvbnZlcnQgdG8gbnVtYmVyIGFuZCBpbmNyZW1lbnRcbiAgICAgICAgICAgIGlmIChhcmdzLmxlbmd0aCA+IGtleSkge1xuICAgICAgICAgICAgICAgIHZhciBodG1sRW5jb2Rlck5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdESVYnKTtcbiAgICAgICAgICAgICAgICBodG1sRW5jb2Rlck5vZGUudGV4dENvbnRlbnQgPSBhcmdzW2tleV07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGh0bWxFbmNvZGVyTm9kZS5pbm5lckhUTUw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xufVxuXG4vKipcbiAqIEBzdW1tYXJ5IFJlcGxhY2UgY29udGVudHMgb2YgYGVsYCB3aXRoIGBOb2Rlc2AgZ2VuZXJhdGVkIGZyb20gZm9ybWF0dGVkIHRlbXBsYXRlLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfGZ1bmN0aW9ufSB0ZW1wbGF0ZSAtIFNlZSBgdGVtcGxhdGVgIHBhcmFtZXRlciBvZiB7QGxpbmsgYXV0b21hdH0uXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gW2VsXSAtIE5vZGUgaW4gd2hpY2ggdG8gcmV0dXJuIG1hcmt1cCBnZW5lcmF0ZWQgZnJvbSB0ZW1wbGF0ZS4gSWYgb21pdHRlZCwgYSBuZXcgYDxkaXY+Li4uPC9kaXY+YCBlbGVtZW50IHdpbGwgYmUgY3JlYXRlZCBhbmQgcmV0dXJuZWQuXG4gKlxuICogQHBhcmFtIHsuLi4qfSBbcmVwbGFjZW1lbnRzXSAtIFJlcGxhY2VtZW50IHZhbHVlcyBmb3IgbnVtYmVyZWQgZm9ybWF0IHBhdHRlcm5zLlxuICpcbiAqIEByZXR1cm4ge0hUTUxFbGVtZW50fSBUaGUgYGVsYCBwcm92aWRlZCBvciBhIG5ldyBgPGRpdj4uLi48L2Rpdj5gIGVsZW1lbnQsIGl0cyBgaW5uZXJIVE1MYCBzZXQgdG8gdGhlIGZvcm1hdHRlZCB0ZXh0LlxuICpcbiAqIEBtZW1iZXJPZiBtb2R1bGU6YXV0b21hdFxuICovXG5mdW5jdGlvbiByZXBsYWNlKHRlbXBsYXRlLCBlbCwgcmVwbGFjZW1lbnRzLyouLi4qLykge1xuICAgIHZhciBlbE9taXR0ZWQgPSB0eXBlb2YgZWwgIT09ICdvYmplY3QnLFxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGlmIChlbE9taXR0ZWQpIHtcbiAgICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdESVYnKTtcbiAgICAgICAgYXJncy51bnNoaWZ0KHRlbXBsYXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhcmdzWzBdID0gdGVtcGxhdGU7XG4gICAgfVxuXG4gICAgZWwuaW5uZXJIVE1MID0gYXV0b21hdC5hcHBseShudWxsLCBhcmdzKTtcblxuICAgIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBBcHBlbmQgb3IgaW5zZXJ0IGBOb2RlYHMgZ2VuZXJhdGVkIGZyb20gZm9ybWF0dGVkIHRlbXBsYXRlIGludG8gZ2l2ZW4gYGVsYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xmdW5jdGlvbn0gdGVtcGxhdGUgLSBTZWUgYHRlbXBsYXRlYCBwYXJhbWV0ZXIgb2Yge0BsaW5rIGF1dG9tYXR9LlxuICpcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsXG4gKlxuICogQHBhcmFtIHtOb2RlfSBbcmVmZXJlbmNlTm9kZT1udWxsXSBJbnNlcnRzIGJlZm9yZSB0aGlzIGVsZW1lbnQgd2l0aGluIGBlbGAgb3IgYXQgZW5kIG9mIGBlbGAgaWYgYG51bGxgLlxuICpcbiAqIEBwYXJhbSB7Li4uKn0gW3JlcGxhY2VtZW50c10gLSBSZXBsYWNlbWVudCB2YWx1ZXMgZm9yIG51bWJlcmVkIGZvcm1hdCBwYXR0ZXJucy5cbiAqXG4gKiBAcmV0dXJucyB7Tm9kZVtdfSBBcnJheSBvZiB0aGUgZ2VuZXJhdGVkIG5vZGVzICh0aGlzIGlzIGFuIGFjdHVhbCBBcnJheSBpbnN0YW5jZTsgbm90IGFuIEFycmF5LWxpa2Ugb2JqZWN0KS5cbiAqXG4gKiBAbWVtYmVyT2YgbW9kdWxlOmF1dG9tYXRcbiAqL1xuZnVuY3Rpb24gYXBwZW5kKHRlbXBsYXRlLCBlbCwgcmVmZXJlbmNlTm9kZSwgcmVwbGFjZW1lbnRzLyouLi4qLykge1xuICAgIHZhciByZXBsYWNlbWVudHNTdGFydEF0ID0gMyxcbiAgICAgICAgcmVmZXJlbmNlTm9kZU9taXR0ZWQgPSB0eXBlb2YgcmVmZXJlbmNlTm9kZSAhPT0gJ29iamVjdCc7ICAvLyByZXBsYWNlbWVudHMgYXJlIG5ldmVyIG9iamVjdHNcblxuICAgIGlmIChyZWZlcmVuY2VOb2RlT21pdHRlZCkge1xuICAgICAgICByZWZlcmVuY2VOb2RlID0gbnVsbDtcbiAgICAgICAgcmVwbGFjZW1lbnRzU3RhcnRBdCA9IDI7XG4gICAgfVxuXG4gICAgcmVwbGFjZW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCByZXBsYWNlbWVudHNTdGFydEF0KTtcbiAgICB2YXIgcmVzdWx0ID0gW10sXG4gICAgICAgIGRpdiA9IHJlcGxhY2UuYXBwbHkobnVsbCwgW3RlbXBsYXRlXS5jb25jYXQocmVwbGFjZW1lbnRzKSk7XG5cbiAgICB3aGlsZSAoZGl2LmNoaWxkTm9kZXMubGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGRpdi5maXJzdENoaWxkKTtcbiAgICAgICAgZWwuaW5zZXJ0QmVmb3JlKGRpdi5maXJzdENoaWxkLCByZWZlcmVuY2VOb2RlKTsgLy8gcmVtb3ZlcyBjaGlsZCBmcm9tIGRpdlxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogVXNlIHRoaXMgY29udmVuaWVuY2Ugd3JhcHBlciB0byByZXR1cm4gdGhlIGZpcnN0IGNoaWxkIG5vZGUgZGVzY3JpYmVkIGluIGB0ZW1wbGF0ZWAuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd8ZnVuY3Rpb259IHRlbXBsYXRlIC0gSWYgYSBmdW5jdGlvbiwgZXh0cmFjdCB0ZW1wbGF0ZSBmcm9tIGNvbW1lbnQgd2l0aGluLlxuICpcbiAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gVGhlIGZpcnN0IGBOb2RlYCBpbiB5b3VyIHRlbXBsYXRlLlxuICpcbiAqIEBtZW1iZXJPZiBtb2R1bGU6YXV0b21hdFxuICovXG5mdW5jdGlvbiBmaXJzdENoaWxkKHRlbXBsYXRlLCByZXBsYWNlbWVudHMvKi4uLiovKSB7XG4gICAgcmV0dXJuIHJlcGxhY2UuYXBwbHkobnVsbCwgYXJndW1lbnRzKS5maXJzdENoaWxkO1xufVxuXG4vKipcbiAqIFVzZSB0aGlzIGNvbnZlbmllbmNlIHdyYXBwZXIgdG8gcmV0dXJuIHRoZSBmaXJzdCBjaGlsZCBlbGVtZW50IGRlc2NyaWJlZCBpbiBgdGVtcGxhdGVgLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfGZ1bmN0aW9ufSB0ZW1wbGF0ZSAtIElmIGEgZnVuY3Rpb24sIGV4dHJhY3QgdGVtcGxhdGUgZnJvbSBjb21tZW50IHdpdGhpbi5cbiAqXG4gKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR9IFRoZSBmaXJzdCBgSFRNTEVsZW1lbnRgIGluIHlvdXIgdGVtcGxhdGUuXG4gKlxuICogQG1lbWJlck9mIG1vZHVsZTphdXRvbWF0XG4gKi9cbmZ1bmN0aW9uIGZpcnN0RWxlbWVudCh0ZW1wbGF0ZSwgcmVwbGFjZW1lbnRzLyouLi4qLykge1xuICAgIHJldHVybiByZXBsYWNlLmFwcGx5KG51bGwsIGFyZ3VtZW50cykuZmlyc3RFbGVtZW50Q2hpbGQ7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgRmluZHMgc3RyaW5nIHN1YnN0aXR1dGlvbiBsZXhlbWVzIHRoYXQgcmVxdWlyZSBIVE1MIGVuY29kaW5nLlxuICogQGRlc2MgTW9kaWZ5IHRvIHN1aXQuXG4gKiBAZGVmYXVsdCAle259XG4gKiBAdHlwZSB7UmVnRXhwfVxuICogQG1lbWJlck9mIG1vZHVsZTphdXRvbWF0XG4gKi9cbmF1dG9tYXQuZW5jb2RlcnNSZWdleCA9IEVOQ09ERVJTO1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmRzIHN0cmluZyBzdWJzdGl0dXRpb24gbGV4ZW1lcy5cbiAqIEBkZXNjIE1vZGlmeSB0byBzdWl0LlxuICogQGRlZmF1bHQgJHtufVxuICogQHR5cGUge1JlZ0V4cH1cbiAqIEBtZW1iZXJPZiBtb2R1bGU6YXV0b21hdFxuICovXG5hdXRvbWF0LnJlcGxhY2Vyc1JlZ2V4ID0gUkVQTEFDRVJTO1xuXG5hdXRvbWF0LmZvcm1hdCA9IGF1dG9tYXQ7IC8vIGlmIHlvdSBmaW5kIHVzaW5nIGp1c3QgYGF1dG9tYXQoKWAgY29uZnVzaW5nXG5hdXRvbWF0LnJlcGxhY2UgPSByZXBsYWNlO1xuYXV0b21hdC5hcHBlbmQgPSBhcHBlbmQ7XG5hdXRvbWF0LmZpcnN0Q2hpbGQgPSBmaXJzdENoaWxkO1xuYXV0b21hdC5maXJzdEVsZW1lbnQgPSBmaXJzdEVsZW1lbnQ7XG5cbm1vZHVsZS5leHBvcnRzID0gYXV0b21hdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbi8qKiBAbmFtZXNwYWNlIGNzc0luamVjdG9yICovXG5cbi8qKlxuICogQHN1bW1hcnkgSW5zZXJ0IGJhc2Ugc3R5bGVzaGVldCBpbnRvIERPTVxuICpcbiAqIEBkZXNjIENyZWF0ZXMgYSBuZXcgYDxzdHlsZT4uLi48L3N0eWxlPmAgZWxlbWVudCBmcm9tIHRoZSBuYW1lZCB0ZXh0IHN0cmluZyhzKSBhbmQgaW5zZXJ0cyBpdCBidXQgb25seSBpZiBpdCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0IGluIHRoZSBzcGVjaWZpZWQgY29udGFpbmVyIGFzIHBlciBgcmVmZXJlbmNlRWxlbWVudGAuXG4gKlxuICogPiBDYXZlYXQ6IElmIHN0eWxlc2hlZXQgaXMgZm9yIHVzZSBpbiBhIHNoYWRvdyBET00sIHlvdSBtdXN0IHNwZWNpZnkgYSBsb2NhbCBgcmVmZXJlbmNlRWxlbWVudGAuXG4gKlxuICogQHJldHVybnMgQSByZWZlcmVuY2UgdG8gdGhlIG5ld2x5IGNyZWF0ZWQgYDxzdHlsZT4uLi48L3N0eWxlPmAgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gY3NzUnVsZXNcbiAqIEBwYXJhbSB7c3RyaW5nfSBbSURdXG4gKiBAcGFyYW0ge3VuZGVmaW5lZHxudWxsfEVsZW1lbnR8c3RyaW5nfSBbcmVmZXJlbmNlRWxlbWVudF0gLSBDb250YWluZXIgZm9yIGluc2VydGlvbi4gT3ZlcmxvYWRzOlxuICogKiBgdW5kZWZpbmVkYCB0eXBlIChvciBvbWl0dGVkKTogaW5qZWN0cyBzdHlsZXNoZWV0IGF0IHRvcCBvZiBgPGhlYWQ+Li4uPC9oZWFkPmAgZWxlbWVudFxuICogKiBgbnVsbGAgdmFsdWU6IGluamVjdHMgc3R5bGVzaGVldCBhdCBib3R0b20gb2YgYDxoZWFkPi4uLjwvaGVhZD5gIGVsZW1lbnRcbiAqICogYEVsZW1lbnRgIHR5cGU6IGluamVjdHMgc3R5bGVzaGVldCBpbW1lZGlhdGVseSBiZWZvcmUgZ2l2ZW4gZWxlbWVudCwgd2hlcmV2ZXIgaXQgaXMgZm91bmQuXG4gKiAqIGBzdHJpbmdgIHR5cGU6IGluamVjdHMgc3R5bGVzaGVldCBpbW1lZGlhdGVseSBiZWZvcmUgZ2l2ZW4gZmlyc3QgZWxlbWVudCBmb3VuZCB0aGF0IG1hdGNoZXMgdGhlIGdpdmVuIGNzcyBzZWxlY3Rvci5cbiAqXG4gKiBAbWVtYmVyT2YgY3NzSW5qZWN0b3JcbiAqL1xuZnVuY3Rpb24gY3NzSW5qZWN0b3IoY3NzUnVsZXMsIElELCByZWZlcmVuY2VFbGVtZW50KSB7XG4gICAgaWYgKHR5cGVvZiByZWZlcmVuY2VFbGVtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihyZWZlcmVuY2VFbGVtZW50KTtcbiAgICAgICAgaWYgKCFyZWZlcmVuY2VFbGVtZW50KSB7XG4gICAgICAgICAgICB0aHJvdyAnQ2Fubm90IGZpbmQgcmVmZXJlbmNlIGVsZW1lbnQgZm9yIENTUyBpbmplY3Rpb24uJztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocmVmZXJlbmNlRWxlbWVudCAmJiAhKHJlZmVyZW5jZUVsZW1lbnQgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgICB0aHJvdyAnR2l2ZW4gdmFsdWUgbm90IGEgcmVmZXJlbmNlIGVsZW1lbnQuJztcbiAgICB9XG5cbiAgICB2YXIgY29udGFpbmVyID0gcmVmZXJlbmNlRWxlbWVudCAmJiByZWZlcmVuY2VFbGVtZW50LnBhcmVudE5vZGUgfHwgZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdO1xuXG4gICAgaWYgKElEKSB7XG4gICAgICAgIElEID0gY3NzSW5qZWN0b3IuaWRQcmVmaXggKyBJRDtcblxuICAgICAgICBpZiAoY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJyMnICsgSUQpKSB7XG4gICAgICAgICAgICByZXR1cm47IC8vIHN0eWxlc2hlZXQgYWxyZWFkeSBpbiBET01cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7XG4gICAgaWYgKElEKSB7XG4gICAgICAgIHN0eWxlLmlkID0gSUQ7XG4gICAgfVxuICAgIGlmIChjc3NSdWxlcyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGNzc1J1bGVzID0gY3NzUnVsZXMuam9pbignXFxuJyk7XG4gICAgfVxuICAgIGNzc1J1bGVzID0gJ1xcbicgKyBjc3NSdWxlcyArICdcXG4nO1xuICAgIGlmIChzdHlsZS5zdHlsZVNoZWV0KSB7XG4gICAgICAgIHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1J1bGVzO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzc1J1bGVzKSk7XG4gICAgfVxuXG4gICAgaWYgKHJlZmVyZW5jZUVsZW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZWZlcmVuY2VFbGVtZW50ID0gY29udGFpbmVyLmZpcnN0Q2hpbGQ7XG4gICAgfVxuXG4gICAgY29udGFpbmVyLmluc2VydEJlZm9yZShzdHlsZSwgcmVmZXJlbmNlRWxlbWVudCk7XG5cbiAgICByZXR1cm4gc3R5bGU7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgT3B0aW9uYWwgcHJlZml4IGZvciBgPHN0eWxlPmAgdGFnIElEcy5cbiAqIEBkZXNjIERlZmF1bHRzIHRvIGAnaW5qZWN0ZWQtc3R5bGVzaGVldC0nYC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAbWVtYmVyT2YgY3NzSW5qZWN0b3JcbiAqL1xuY3NzSW5qZWN0b3IuaWRQcmVmaXggPSAnaW5qZWN0ZWQtc3R5bGVzaGVldC0nO1xuXG4vLyBJbnRlcmZhY2Vcbm1vZHVsZS5leHBvcnRzID0gY3NzSW5qZWN0b3I7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXV0b21hdCA9IHJlcXVpcmUoJ2F1dG9tYXQnKTtcblxuLyoqXG4gKiBAc3VtbWFyeSBJbmplY3RzIHRoZSBuYW1lZCBzdHlsZXNoZWV0IGludG8gYDxoZWFkPmAuXG4gKiBAZGVzYyBTdHlsZXNoZWV0cyBhcmUgaW5zZXJ0ZWQgY29uc2VjdXRpdmVseSBhdCBlbmQgb2YgYDxoZWFkPmAgdW5sZXNzIGBiZWZvcmUgPT09IHRydWVgIChvciBvbWl0dGVkIGFuZCBgaW5qZWN0U3R5bGVzaGVldFRlbXBsYXRlLmJlZm9yZWAgdHJ1dGh5KSBpbiB3aGljaCBjYXNlIHRoZXkgYXJlIGluc2VydGVkIGNvbnNlY3V0aXZlbHkgYmVmb3JlIGZpcnN0IHN0eWxlc2hlZXQgZm91bmQgaW4gYDxoZWFkPmAgKGlmIGFueSkgYXQgbG9hZCB0aW1lLlxuICpcbiAqIFRoZSBjYWxsaW5nIGNvbnRleHQgKGB0aGlzYCkgaXMgYSBzdHlsZXNoZWV0IHJlZ2lzdHJ5LlxuICogSWYgYHRoaXNgIGlzIHVuZGVmaW5lZCwgdGhlIGdsb2JhbCBzdHlsZXNoZWV0IHJlZ2lzdHJ5IChjc3MvaW5kZXguanMpIGlzIHVzZWQuXG4gKiBAdGhpcyB7b2JqZWN0fVxuICogQHBhcmFtIHtib29sZWFufSBbYmVmb3JlPWluamVjdFN0eWxlc2hlZXRUZW1wbGF0ZS5iZWZvcmVdIC0gQWRkIHN0eWxlc2hlZXQgYmVmb3JlIGludGlhbGx5IGxvYWRlZCBzdHlsZXNoZWV0cy5cbiAqXG4gKiBfSWYgb21pdHRlZDpfXG4gKiAxLiBgaWRgIGlzIHByb21vdGVkIHRvIGZpcnN0IGFyZ3VtZW50IHBvc2l0aW9uXG4gKiAyLiBgaW5qZWN0U3R5bGVzaGVldFRlbXBsYXRlLmJlZm9yZWAgaXMgYHRydWVgIGJ5IGRlZmF1bHRcbiAqIEBwYXJhbSB7c3RyaW5nfSBpZCAtIFRoZSBuYW1lIG9mIHRoZSBzdHlsZSBzaGVldCBpbiBgdGhpc2AsIGEgc3R5bGVzaGVldCBcInJlZ2lzdHJ5XCIgKGhhc2ggb2Ygc3R5bGVzaGVldHMpLlxuICogQHJldHVybnMge0VsZW1lbnR8Kn1cbiAqL1xuZnVuY3Rpb24gaW5qZWN0U3R5bGVzaGVldFRlbXBsYXRlKGJlZm9yZSwgaWQpIHtcbiAgICB2YXIgb3B0aW9uYWxBcmdzU3RhcnRBdCwgc3R5bGVzaGVldCwgaGVhZCwgcmVmTm9kZSwgY3NzLCBhcmdzLFxuICAgICAgICBwcmVmaXggPSBpbmplY3RTdHlsZXNoZWV0VGVtcGxhdGUucHJlZml4O1xuXG4gICAgaWYgKHR5cGVvZiBiZWZvcmUgPT09ICdib29sZWFuJykge1xuICAgICAgICBvcHRpb25hbEFyZ3NTdGFydEF0ID0gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZCA9IGJlZm9yZTtcbiAgICAgICAgYmVmb3JlID0gaW5qZWN0U3R5bGVzaGVldFRlbXBsYXRlLmJlZm9yZTtcbiAgICAgICAgb3B0aW9uYWxBcmdzU3RhcnRBdCA9IDE7XG4gICAgfVxuXG4gICAgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHByZWZpeCArIGlkKTtcblxuICAgIGlmICghc3R5bGVzaGVldCkge1xuICAgICAgICBoZWFkID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaGVhZCcpO1xuXG4gICAgICAgIGlmIChiZWZvcmUpIHtcbiAgICAgICAgICAgIC8vIG5vdGUgcG9zaXRpb24gb2YgZmlyc3Qgc3R5bGVzaGVldFxuICAgICAgICAgICAgcmVmTm9kZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGhlYWQuY2hpbGRyZW4pLmZpbmQoZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICAgICAgICB2YXIgaWQgPSBjaGlsZC5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkLnRhZ05hbWUgPT09ICdTVFlMRScgJiYgKCFpZCB8fCBpZC5pbmRleE9mKHByZWZpeCkgIT09IHByZWZpeCkgfHxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQudGFnTmFtZSA9PT0gJ0xJTksnICYmIGNoaWxkLmdldEF0dHJpYnV0ZSgncmVsJykgPT09ICdzdHlsZXNoZWV0JztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY3NzID0gdGhpc1tpZF07XG5cbiAgICAgICAgaWYgKCFjc3MpIHtcbiAgICAgICAgICAgIHRocm93ICdFeHBlY3RlZCB0byBmaW5kIG1lbWJlciBgJyArIGlkICsgJ2AgaW4gY2FsbGluZyBjb250ZXh0Lic7XG4gICAgICAgIH1cblxuICAgICAgICBhcmdzID0gW1xuICAgICAgICAgICAgJzxzdHlsZT5cXG4nICsgY3NzICsgJ1xcbjwvc3R5bGU+XFxuJyxcbiAgICAgICAgICAgIGhlYWQsXG4gICAgICAgICAgICByZWZOb2RlIHx8IG51bGwgLy8gZXhwbGljaXRseSBudWxsIHBlciBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTm9kZS9pbnNlcnRCZWZvcmVcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGFyZ3MgPSBhcmdzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIG9wdGlvbmFsQXJnc1N0YXJ0QXQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0eWxlc2hlZXQgPSBhdXRvbWF0LmFwcGVuZC5hcHBseShudWxsLCBhcmdzKVswXTtcbiAgICAgICAgc3R5bGVzaGVldC5pZCA9IHByZWZpeCArIGlkO1xuICAgIH1cblxuICAgIHJldHVybiBzdHlsZXNoZWV0O1xufVxuXG5pbmplY3RTdHlsZXNoZWV0VGVtcGxhdGUuYmVmb3JlID0gdHJ1ZTtcbmluamVjdFN0eWxlc2hlZXRUZW1wbGF0ZS5wcmVmaXggPSAnaW5qZWN0ZWQtc3R5bGVzaGVldC0nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGluamVjdFN0eWxlc2hlZXRUZW1wbGF0ZTtcbiIsIi8vIGxpc3QtZHJhZ29uIG5vZGUgbW9kdWxlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L2xpc3QtZHJhZ29uXG5cbi8qIGVzbGludC1lbnYgbm9kZSwgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBjc3NJbmplY3RvciA9IHJlcXVpcmUoJ2Nzcy1pbmplY3RvcicpO1xudmFyIGZvcm1hdCA9IHJlcXVpcmUoJ3RlbXBsZXgnKTtcblxudmFyIFJFVkVSVF9UT19TVFlMRVNIRUVUX1ZBTFVFID0gbnVsbDsgIC8vIG51bGwgcmVtb3ZlcyB0aGUgc3R5bGVcblxudmFyIHRyYW5zZm9ybSwgdGltZXIsIHNjcm9sbFZlbG9jaXR5LCBjc3NMaXN0RHJhZ29uO1xuXG4vKiBpbmplY3Q6Y3NzICovXG5jc3NMaXN0RHJhZ29uID0gJ2Rpdi5kcmFnb24tbGlzdHtwb3NpdGlvbjpyZWxhdGl2ZTtiYWNrZ3JvdW5kLWNvbG9yOiNmZmZ9ZGl2LmRyYWdvbi1saXN0PmRpdixkaXYuZHJhZ29uLWxpc3Q+dWx7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3JpZ2h0OjB9ZGl2LmRyYWdvbi1saXN0PmRpdnt0ZXh0LWFsaWduOmNlbnRlcjtiYWNrZ3JvdW5kLWNvbG9yOiMwMDc5NmI7Y29sb3I6I2ZmZjtib3gtc2hhZG93OjAgM3B4IDZweCByZ2JhKDAsMCwwLC4xNiksMCAzcHggNnB4IHJnYmEoMCwwLDAsLjIzKTtvdmVyZmxvdzpoaWRkZW47d2hpdGUtc3BhY2U6bm93cmFwfWRpdi5kcmFnb24tbGlzdD51bHtvdmVyZmxvdy15OmF1dG87Ym90dG9tOjA7bWFyZ2luOjA7cGFkZGluZzowO2JveC1zaGFkb3c6MCAxcHggM3B4IHJnYmEoMCwwLDAsLjEyKSwwIDFweCAycHggcmdiYSgwLDAsMCwuMjQpfWRpdi5kcmFnb24tbGlzdD51bD5saSxsaS5kcmFnb24tcG9we3doaXRlLXNwYWNlOm5vd3JhcDtsaXN0LXN0eWxlLXR5cGU6bm9uZTtib3JkZXI6MCBzb2xpZCAjZjRmNGY0O2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNlMGUwZTA7Y3Vyc29yOm1vdmU7dHJhbnNpdGlvbjpib3JkZXItdG9wLXdpZHRoIC4yc31kaXYuZHJhZ29uLWxpc3Q+dWw+bGk6bGFzdC1jaGlsZHtoZWlnaHQ6MDtib3JkZXItYm90dG9tOm5vbmV9bGkuZHJhZ29uLXBvcHtwb3NpdGlvbjpmaXhlZDtiYWNrZ3JvdW5kLWNvbG9yOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCAjZTBlMGUwO2xlZnQ6MDt0b3A6MDtvdmVyZmxvdy14OmhpZGRlbjtib3gtc2hhZG93OnJnYmEoMCwwLDAsLjE4ODIzNSkgMCAxMHB4IDIwcHgscmdiYSgwLDAsMCwuMjI3NDUxKSAwIDZweCA2cHh9Jztcbi8qIGVuZGluamVjdCAqL1xuXG4vKipcbiAqIEBjb25zdHJ1Y3RvciBMaXN0RHJhZ29uXG4gKlxuICogQGRlc2MgVGhpcyBvYmplY3Qgc2VydmljZXMgYSBzZXQgb2YgaXRlbSBsaXN0cyB0aGF0IGFsbG93IGRyYWdnaW5nIGFuZCBkcm9wcGluZyBpdGVtcyB3aXRoaW4gYW5kIGJldHdlZW4gbGlzdHMgaW4gYSBzZXQuXG4gKlxuICogVHdvIHN0cmF0ZWdpZXMgYXJlIHN1cHBvcnRlZDpcbiAqXG4gKiAxLiBTdXBwbHkgeW91ciBvd24gSFRNTCBtYXJrdXAgYW5kIGxldCB0aGUgQVBJIGJ1aWxkIHRoZSBpdGVtIG1vZGVscyBmb3IgeW91LlxuICogICAgVG8gdXNlIHRoaXMgc3RyYXRlZ3ksIHNjcmlwdCB5b3VyIEhUTUwgYW5kIHByb3ZpZGUgb25lIG9mIHRoZXNlOlxuICogICAgKiBhbiBhcnJheSBvZiBhbGwgdGhlIGxpc3QgaXRlbSAoYDxsaT5gKSB0YWdzXG4gKiAgICAqIGEgQ1NTIHNlbGVjdG9yIHRoYXQgcG9pbnRzIHRvIGFsbCB0aGUgbGlzdCBpdGVtIHRhZ3NcbiAqIDIuIFN1cHBseSB5b3VyIG93biBpdGVtIG1vZGVscyBhbmQgbGV0IHRoZSBBUEkgYnVpbGQgdGhlIEhUTUwgbWFya3VwIGZvciB5b3UuXG4gKiAgICBUbyB1c2UgdGhpcyBzdHJhdGVneSwgcHJvdmlkZSBhbiBhcnJheSBvZiBtb2RlbCBsaXN0cy5cbiAqXG4gKiBUaGUgbmV3IExpc3REcmFnb24gb2JqZWN0J3MgYG1vZGVsTGlzdHNgIHByb3BlcnR5IHJlZmVyZW5jZXMgdGhlIGFycmF5IG9mIG1vZGVsIGxpc3RzIHRoZSBBUEkgY29uc3RydWN0ZWQgZm9yIHlvdSBpbiBzdHJhdGVneSAjMSBvciB0aGUgYXJyYXkgb2YgbW9kZWwgbGlzdHMgeW91IHN1cHBsaWVkIGZvciBzdHJhdGVneSAjMi5cbiAqXG4gKiBBZnRlciB0aGUgdXNlciBwZXJmb3JtcyBhIHN1Y2Nlc3NmdWwgZHJhZy1hbmQtZHJvcCBvcGVyYXRpb24sIHRoZSBwb3NpdGlvbiBvZiB0aGUgbW9kZWwgcmVmZXJlbmNlcyB3aXRoaW4gdGhlIGBtb2RlbExpc3RzYCBhcnJheSBpcyByZWFycmFuZ2VkLiAoVGhlIG1vZGVscyB0aGVtc2VsdmVzIGFyZSB0aGUgb3JpZ2luYWwgb2JqZWN0cyBhcyBzdXBwbGllZCBpbiB0aGUgbW9kZWwgbGlzdHM7IHRoZXkgYXJlIG5vdCByZWJ1aWx0IG9yIGFsdGVyZWQgaW4gYW55IHdheS4gSnVzdCB0aGUgcmVmZXJlbmNlcyB0byB0aGVtIGFyZSBtb3ZlZCBhcm91bmQuKVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfEVsZW1lbnRbXXxtb2RlbExpc3RUeXBlW119IHNlbGVjdG9yT3JNb2RlbExpc3RzIC0gWW91IG11c3Qgc3VwcGx5IG9uZSBvZiB0aGUgaXRlbXMgaW4gKipib2xkKiogYmVsb3c6XG4gKlxuICogMS4gX0ZvciBzdHJhdGVneSAjMSBhYm92ZSAoQVBJIGNyZWF0ZXMgbW9kZWxzIGZyb20gc3VwcGxpZWQgZWxlbWVudHMpOl8gQWxsIHRoZSBsaXN0IGl0ZW0gKGA8bGk+YCkgRE9NIGVsZW1lbnRzIG9mIGFsbCB0aGUgbGlzdHMgeW91IHdhbnQgdGhlIG5ldyBvYmplY3QgdG8gbWFuYWdlLCBhcyBlaXRoZXI6XG4gKiAgICAxLiAqKkEgQ1NTIHNlbGVjdG9yOyoqIF9vcl9cbiAqICAgIDIuICoqQW4gYXJyYXkgb2YgRE9NIGVsZW1lbnRzKipcbiAqIDIuIF9Gb3Igc3RyYXRlZ3kgIzIgYWJvdmUgKEFQSSBjcmVhdGVzIGVsZW1lbnRzIGZyb20gc3VwcGxpZWQgbW9kZWxzKTpfICoqQW4gYXJyYXkgb2YgbW9kZWwgbGlzdHMsKiogZWFjaCBvZiB3aGljaCBpcyBpbiBvbmUgb2YgdGhlIGZvbGxvd2luZyBmb3JtczpcbiAqICAgIDEuIEFuIGFycmF5IG9mIGl0ZW0gbW9kZWxzICh3aXRoIHZhcmlvdXMgb3B0aW9uIHByb3BlcnRpZXMgaGFuZ2luZyBvZmYgb2YgaXQpOyBfYW5kL29yX1xuICogICAgMi4gQSB7QGxpbmsgbW9kZWxMaXN0VHlwZX0gb2JqZWN0IHdpdGggdGhvc2Ugc2FtZSB2YXJpb3VzIG9wdGlvbiBwcm9wZXJ0aWVzIGluY2x1ZGluZyB0aGUgcmVxdWlyZWQgYG1vZGVsc2AgcHJvcGVydHkgY29udGFpbmluZyB0aGF0IHNhbWUgYXJyYXkgb2YgaXRlbSBtb2RlbHMuXG4gKlxuICogSW4gZWl0aGVyIGNhc2UgKDIuMSBvciAyLjIpLCBlYWNoIGVsZW1lbnQgb2Ygc3VjaCBhcnJheXMgb2YgaXRlbSBtb2RlbHMgbWF5IHRha2UgdGhlIGZvcm0gb2Y6XG4gKiAqIEEgc3RyaW5nIHByaW1pdGl2ZTsgX29yX1xuICogKiBBIHtAbGluayBpdGVtTW9kZWxUeXBlfSBvYmplY3Qgd2l0aCBhIHZhcmlvdXMgb3B0aW9uIHByb3BlcnRpZXMgaW5jbHVkaW5nIHRoZSByZXF1aXJlZCBgbGFiZWxgIHByb3BlcnR5IGNvbnRhaW5pbmcgYSBzdHJpbmcgcHJpbWl0aXZlLlxuICpcbiAqIFJlZ2FyZGluZyB0aGVzZSBzdHJpbmcgcHJpbWl0aXZlcywgZWFjaCBpcyBlaXRoZXI6XG4gKiAqIEEgc3RyaW5nIHRvIGJlIGRpc3BsYXllZCBpbiB0aGUgbGlzdCBpdGVtOyBfb3JfXG4gKiAqIEEgZm9ybWF0IHN0cmluZyB3aXRoIG90aGVyIHByb3BlcnR5IHZhbHVlcyBtZXJnZWQgaW4sIHRoZSByZXN1bHQgb2Ygd2hpY2ggaXMgdG8gYmUgZGlzcGxheWVkIGluIHRoZSBsaXN0IGl0ZW0uXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zPXt9XSAtIFlvdSBtYXkgc3VwcGx5IFwiZ2xvYmFsXCIgdGVtcGxhdGUgdmFyaWFibGVzIGhlcmUsIHJlcHJlc2VudGluZyB0aGUgXCJvdXRlciBzY29wZSxcIiBhZnRlciBmaXJzdCBzZWFyY2hpbmcgZWFjaCBtb2RlbCBhbmQgdGhlbiBlYWNoIG1vZGVsIGxpc3QuXG4gKiBAcGFyYW0ge3VuZGVmaW5lZHxudWxsfEVsZW1lbnR8c3RyaW5nfSBbY3NzU3R5bGVzaGVldFJlZmVyZW5jZUVsZW1lbnRdIC0gRGV0ZXJtaW5lcyB3aGVyZSB0byBpbnNlcnQgdGhlIHN0eWxlc2hlZXQuIChUaGlzIGlzIHRoZSBvbmx5IGZvcm1hbCBvcHRpb24uKSBQYXNzZWQgdG8gY3NzLWluamVjdG9yLCB0aGUgb3ZlcmxvYWRzIGFyZSAoZnJvbSBjc3MtaW5qZWN0b3IgZG9jcyk6XG4gKiAqIGB1bmRlZmluZWRgIHR5cGUgKG9yIG9taXR0ZWQpOiBpbmplY3RzIHN0eWxlc2hlZXQgYXQgdG9wIG9mIGA8aGVhZD4uLi48L2hlYWQ+YCBlbGVtZW50XG4gKiAqIGBudWxsYCB2YWx1ZTogaW5qZWN0cyBzdHlsZXNoZWV0IGF0IGJvdHRvbSBvZiBgPGhlYWQ+Li4uPC9oZWFkPmAgZWxlbWVudFxuICogKiBgRWxlbWVudGAgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBlbGVtZW50LCB3aGVyZXZlciBpdCBpcyBmb3VuZC5cbiAqICogYHN0cmluZ2AgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBmaXJzdCBlbGVtZW50IGZvdW5kIHRoYXQgbWF0Y2hlcyB0aGUgZ2l2ZW4gY3NzIHNlbGVjdG9yLlxuICovXG5mdW5jdGlvbiBMaXN0RHJhZ29uKHNlbGVjdG9yT3JNb2RlbExpc3RzLCBvcHRpb25zKSB7XG5cbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTGlzdERyYWdvbikpIHtcbiAgICAgICAgdGhyb3cgZXJyb3IoJ05vdCBjYWxsZWQgd2l0aCBcIm5ld1wiIGtleXdvcmQuJyk7XG4gICAgfVxuXG4gICAgdmFyIHNlbGYgPSB0aGlzLCBtb2RlbExpc3RzLCBpdGVtcztcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgaWYgKHR5cGVvZiBzZWxlY3Rvck9yTW9kZWxMaXN0cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaXRlbXMgPSB0b0FycmF5KGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3JPck1vZGVsTGlzdHMpKTtcbiAgICAgICAgbW9kZWxMaXN0cyA9IGNyZWF0ZU1vZGVsTGlzdHNGcm9tTGlzdEVsZW1lbnRzKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKHNlbGVjdG9yT3JNb2RlbExpc3RzWzBdIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICBpdGVtcyA9IHRvQXJyYXkoc2VsZWN0b3JPck1vZGVsTGlzdHMpO1xuICAgICAgICBtb2RlbExpc3RzID0gY3JlYXRlTW9kZWxMaXN0c0Zyb21MaXN0RWxlbWVudHMoaXRlbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBhcmFtIGlzIGFycmF5IG9mIG1vZGVsIGxpc3RzXG4gICAgICAgIC8vIGJ1aWxkIG5ldyA8dWw+IGVsZW1lbnQocykgZm9yIGVhY2ggbGlzdCBhbmQgcHV0IGluIGAubW9kZWxMaXN0c2A7XG4gICAgICAgIC8vIGZpbGwgYC5pdGVtc2AgYXJyYXkgd2l0aCA8bGk+IGVsZW1lbnRzIGZyb20gdGhlc2UgbmV3IDx1bD4gZWxlbWVudHNcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICAgICAgbW9kZWxMaXN0cyA9IGNyZWF0ZUxpc3RFbGVtZW50c0Zyb21Nb2RlbExpc3RzKHNlbGVjdG9yT3JNb2RlbExpc3RzLCBvcHRpb25zKTtcbiAgICAgICAgbW9kZWxMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uIChsaXN0KSB7XG4gICAgICAgICAgICBpdGVtcyA9IGl0ZW1zLmNvbmNhdCh0b0FycmF5KGxpc3QuZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCdsaScpKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGdyYWIgd2hlZWwgZXZlbnRzIGFuZCBkb24ndCBsZXQgJ2VtIGJ1YmJsZVxuICAgIG1vZGVsTGlzdHMuZm9yRWFjaChmdW5jdGlvbiAobW9kZWxMaXN0KSB7XG4gICAgICAgIG1vZGVsTGlzdC5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgY2FwdHVyZUV2ZW50KTtcbiAgICB9KTtcblxuICAgIGl0ZW1zLmZvckVhY2goZnVuY3Rpb24gKGl0ZW1FbGVtZW50LCBpbmRleCkge1xuICAgICAgICB2YXIgaXRlbSA9IChpdGVtRWxlbWVudCAhPT0gaXRlbUVsZW1lbnQucGFyZW50RWxlbWVudC5sYXN0RWxlbWVudENoaWxkKVxuICAgICAgICAgICAgPyBzZWxmLmFkZEV2dChpdGVtRWxlbWVudCwgJ21vdXNlZG93bicsIGl0ZW1FbGVtZW50LCB0cnVlKVxuICAgICAgICAgICAgOiB7IGVsZW1lbnQ6IGl0ZW1FbGVtZW50IH07XG5cbiAgICAgICAgLyogYGl0ZW0ubW9kZWxgIG5vdCBjdXJyZW50bHkgbmVlZGVkIHNvIGNvbW1lbnRlZCBvdXQgaGVyZS5cbiAgICAgICAgICogKE9yaWdpbmFsbHkgdXNlZCBmb3IgcmVidWlsZGluZyBtb2RlbExpc3RzIGZvciBmaW5hbFxuICAgICAgICAgKiByZXBvcnRpbmcsIG1vZGVsTGlzdHMgYXJlIG5vdyBzcGxpY2VkIG9uIGV2ZXJ5IHN1Y2Nlc3NmdWxcbiAgICAgICAgICogZHJhZy1hbmQtZHJvcCBvcGVyYXRpb24gc28gdGhleSdyZSBhbHdheXMgdXAgdG8gZGF0ZS4pXG5cbiAgICAgICAgIHZhciBvcmlnaW4gPSB0aGlzLml0ZW1Db29yZGluYXRlcyhpdGVtRWxlbWVudCk7XG4gICAgICAgICBpdGVtLm1vZGVsID0gdGhpcy5tb2RlbExpc3RzW29yaWdpbi5saXN0XS5tb2RlbHNbb3JpZ2luLml0ZW1dO1xuXG4gICAgICAgICAqL1xuXG4gICAgICAgIGl0ZW1zW2luZGV4XSA9IGl0ZW07XG4gICAgfSk7XG5cbiAgICB0cmFuc2Zvcm0gPSAndHJhbnNmb3JtJyBpbiBpdGVtc1swXS5lbGVtZW50LnN0eWxlXG4gICAgICAgID8gJ3RyYW5zZm9ybScgLy8gQ2hyb21lIDQ1IGFuZCBGaXJlZm94IDQwXG4gICAgICAgIDogJy13ZWJraXQtdHJhbnNmb3JtJzsgLy8gU2FmYXJpIDhcblxuICAgIC8vIHNldCB1cCB0aGUgbmV3IG9iamVjdFxuICAgIHRoaXMubW9kZWxMaXN0cyA9IG1vZGVsTGlzdHM7XG4gICAgdGhpcy5pdGVtcyA9IGl0ZW1zO1xuICAgIHRoaXMuYmluZGluZ3MgPSB7fTtcbiAgICB0aGlzLmNhbGxiYWNrID0ge307XG5cbiAgICBjc3NJbmplY3Rvcihjc3NMaXN0RHJhZ29uLCAnbGlzdC1kcmFnb24tYmFzZScsIG9wdGlvbnMuY3NzU3R5bGVzaGVldFJlZmVyZW5jZUVsZW1lbnQpO1xuXG59XG5cbkxpc3REcmFnb24ucHJvdG90eXBlID0ge1xuXG4gICAgYWRkRXZ0OiBmdW5jdGlvbiAodGFyZ2V0LCB0eXBlLCBsaXN0ZW5lciwgZG9Ob3RCaW5kKSB7XG4gICAgICAgIHZhciBiaW5kaW5nID0ge1xuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlcnNbdHlwZV0uYmluZCh0YXJnZXQsIHRoaXMpLFxuICAgICAgICAgICAgZWxlbWVudDogbGlzdGVuZXIgfHwgd2luZG93XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKCFkb05vdEJpbmQpIHtcbiAgICAgICAgICAgIHRoaXMuYmluZGluZ3NbdHlwZV0gPSBiaW5kaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgYmluZGluZy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgYmluZGluZy5oYW5kbGVyKTtcblxuICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICB9LFxuXG4gICAgcmVtb3ZlRXZ0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICB2YXIgYmluZGluZyA9IHRoaXMuYmluZGluZ3NbdHlwZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLmJpbmRpbmdzW3R5cGVdO1xuICAgICAgICBiaW5kaW5nLmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBiaW5kaW5nLmhhbmRsZXIpO1xuICAgIH0sXG5cbiAgICByZW1vdmVBbGxFdmVudExpc3RlbmVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyByZW1vdmUgZHJhZyAmIGRyb3AgZXZlbnRzIChtb3VzZW1vdmUsIG1vdXNldXAsIGFuZCB0cmFuc2l0aW9uZW5kKVxuICAgICAgICBmb3IgKHZhciB0eXBlIGluIHRoaXMuYmluZGluZ3MpIHtcbiAgICAgICAgICAgIHZhciBiaW5kaW5nID0gdGhpcy5iaW5kaW5nc1t0eXBlXTtcbiAgICAgICAgICAgIGJpbmRpbmcuZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGJpbmRpbmcuaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIHRoZSBtb3VzZWRvd24gZXZlbnRzIGZyb20gYWxsIGxpc3QgaXRlbXNcbiAgICAgICAgdGhpcy5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICBpZiAoaXRlbS5oYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgaXRlbS5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGl0ZW0uaGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyB3aGVlbCBldmVudHMgb24gdGhlIGxpc3QgZWxlbWVudHNcbiAgICAgICAgdGhpcy5tb2RlbExpc3RzLmZvckVhY2goZnVuY3Rpb24gKG1vZGVsTGlzdCkge1xuICAgICAgICAgICAgbW9kZWxMaXN0LmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2hlZWwnLCBjYXB0dXJlRXZlbnQpO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgcG9pbnRJbkxpc3RSZWN0czogZnVuY3Rpb24gKHBvaW50KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1vZGVsTGlzdHMuZmluZChmdW5jdGlvbiAobW9kZWxMaXN0KSB7XG4gICAgICAgICAgICB2YXIgcmVjdCA9IG1vZGVsTGlzdC5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgICAgICByZWN0ID0ge1xuICAgICAgICAgICAgICAgIGxlZnQ6ICAgd2luZG93LnNjcm9sbFggKyByZWN0LmxlZnQsXG4gICAgICAgICAgICAgICAgdG9wOiAgICB3aW5kb3cuc2Nyb2xsWSArIHJlY3QudG9wLFxuICAgICAgICAgICAgICAgIHJpZ2h0OiAgd2luZG93LnNjcm9sbFggKyByZWN0LnJpZ2h0LFxuICAgICAgICAgICAgICAgIGJvdHRvbTogd2luZG93LnNjcm9sbFkgKyByZWN0LmJvdHRvbSxcbiAgICAgICAgICAgICAgICB3aWR0aDogIHJlY3Qud2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiByZWN0LmhlaWdodFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbW9kZWxMaXN0LnJlY3QgPSByZWN0O1xuXG4gICAgICAgICAgICBpZiAocG9pbnRJblJlY3QocG9pbnQsIHJlY3QpKSB7XG4gICAgICAgICAgICAgICAgbW9kZWxMaXN0LnJlY3QgPSByZWN0O1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBmb3VuZFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBwb2ludEluSXRlbVJlY3RzOiBmdW5jdGlvbiAocG9pbnQsIGV4Y2VwdDEsIGV4Y2VwdDIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXRlbXMuZmluZChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBpdGVtLmVsZW1lbnQ7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIGVsZW1lbnQgIT09IGV4Y2VwdDEgJiZcbiAgICAgICAgICAgICAgICBlbGVtZW50ICE9PSBleGNlcHQyICYmXG4gICAgICAgICAgICAgICAgcG9pbnRJblJlY3QocG9pbnQsIGl0ZW0ucmVjdClcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvLyBnZXQgcG9zaXRpb25zIG9mIGFsbCBsaXN0IGl0ZW1zIGluIHBhZ2UgY29vcmRzIChub3JtYWxpemVkIGZvciB3aW5kb3cgYW5kIGxpc3Qgc2Nyb2xsaW5nKVxuICAgIGdldEFsbEl0ZW1Cb3VuZGluZ1JlY3RzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBtb2RlbExpc3RzID0gdGhpcy5tb2RlbExpc3RzLCBoZWlnaHQ7XG4gICAgICAgIHRoaXMuaXRlbXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgdmFyIGl0ZW1FbGVtZW50ID0gaXRlbS5lbGVtZW50LFxuICAgICAgICAgICAgICAgIGxpc3RFbGVtZW50ID0gaXRlbUVsZW1lbnQucGFyZW50RWxlbWVudCxcbiAgICAgICAgICAgICAgICBsaXN0ID0gbW9kZWxMaXN0cy5maW5kKGZ1bmN0aW9uIChsaXN0KSB7IHJldHVybiBsaXN0LmVsZW1lbnQgPT09IGxpc3RFbGVtZW50OyB9KTtcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIC8vIG9taXR0ZWQ6IGRlZmF1bHQgdG8gdHJ1ZVxuICAgICAgICAgICAgICAgIGxpc3QuaXNEcm9wVGFyZ2V0ID09PSB1bmRlZmluZWQgfHxcblxuICAgICAgICAgICAgICAgIC8vIGZ1bmN0aW9uOiB1c2UgcmV0dXJuIHZhbHVlXG4gICAgICAgICAgICAgICAgdHlwZW9mIGxpc3QuaXNEcm9wVGFyZ2V0ID09PSAnZnVuY3Rpb24nICYmIGxpc3QuaXNEcm9wVGFyZ2V0KCkgfHxcblxuICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZTogdXNlIHRydXRoaW5lc3Mgb2YgZ2l2ZW4gdmFsdWVcbiAgICAgICAgICAgICAgICBsaXN0LmlzRHJvcFRhcmdldFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdmFyIHJlY3QgPSBpdGVtRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgICAgICAgICAgICAgYm90dG9tID0gcmVjdC5ib3R0b207XG5cbiAgICAgICAgICAgICAgICBpZiAoaXRlbUVsZW1lbnQgPT09IGxpc3RFbGVtZW50Lmxhc3RFbGVtZW50Q2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgYm90dG9tID0gbGlzdEVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuYm90dG9tO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYm90dG9tIDwgcmVjdC50b3ApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvdHRvbSA9IHJlY3QudG9wICsgKGhlaWdodCB8fCA1MCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZWN0ID0ge1xuICAgICAgICAgICAgICAgICAgICBsZWZ0OiAgIHdpbmRvdy5zY3JvbGxYICsgcmVjdC5sZWZ0LFxuICAgICAgICAgICAgICAgICAgICByaWdodDogIHdpbmRvdy5zY3JvbGxYICsgcmVjdC5yaWdodCxcbiAgICAgICAgICAgICAgICAgICAgdG9wOiAgICB3aW5kb3cuc2Nyb2xsWSArIHJlY3QudG9wICAgICsgbGlzdEVsZW1lbnQuc2Nyb2xsVG9wLFxuICAgICAgICAgICAgICAgICAgICBib3R0b206IHdpbmRvdy5zY3JvbGxZICsgYm90dG9tICsgbGlzdEVsZW1lbnQuc2Nyb2xsVG9wXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGl0ZW0ucmVjdCA9IHJlY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICByZWluc2VydDogZnVuY3Rpb24gKHRhcmdldCkge1xuICAgICAgICB2YXIgc3R5bGUgPSB0YXJnZXQuc3R5bGU7XG4gICAgICAgIHN0eWxlLndpZHRoID0gc3R5bGVbdHJhbnNmb3JtXSA9IHN0eWxlLnRyYW5zaXRpb24gPSBSRVZFUlRfVE9fU1RZTEVTSEVFVF9WQUxVRTtcblxuICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ29uLXBvcCcpO1xuXG4gICAgICAgIHRoaXMuZHJvcC5zdHlsZS50cmFuc2l0aW9uRHVyYXRpb24gPSAnMHMnO1xuICAgICAgICB0aGlzLmRyb3Auc3R5bGUuYm9yZGVyVG9wV2lkdGggPSBSRVZFUlRfVE9fU1RZTEVTSEVFVF9WQUxVRTtcbiAgICAgICAgdGhpcy5kcm9wLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKHRhcmdldCwgdGhpcy5kcm9wKTtcblxuICAgICAgICBkZWxldGUgdGhpcy5kcm9wO1xuICAgIH0sXG5cbiAgICAvLyByZXR1cm4gYW4gb2JqZWN0IHsgaXRlbTogPGl0ZW0gaW5kZXggd2l0aGluIGxpc3Q+LCBsaXN0OiA8bGlzdCBpbmRleCB3aXRoaW4gbGlzdCBvZiBsaXN0cz4gfVxuICAgIGl0ZW1Db29yZGluYXRlczogZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgICAgdmFyIGxpc3RFbGVtZW50ID0gaXRlbS5wYXJlbnRFbGVtZW50LFxuICAgICAgICAgICAgY29vcmRzID0geyBpdGVtOiAwIH07XG5cbiAgICAgICAgd2hpbGUgKChpdGVtID0gaXRlbS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nKSkge1xuICAgICAgICAgICAgKytjb29yZHMuaXRlbTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubW9kZWxMaXN0cy5maW5kKGZ1bmN0aW9uIChsaXN0LCBpbmRleCkge1xuICAgICAgICAgICAgY29vcmRzLmxpc3QgPSBpbmRleDtcbiAgICAgICAgICAgIHJldHVybiBsaXN0LmVsZW1lbnQgPT09IGxpc3RFbGVtZW50OyAvLyBzdG9wIHdoZW4gd2UgZmluZCB0aGUgb25lIHdlIGJlbG9uZyB0b1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gY29vcmRzO1xuICAgIH1cblxufTtcblxudmFyIGhhbmRsZXJzID0ge1xuICAgIG1vdXNlZG93bjogZnVuY3Rpb24gKGRyYWdvbiwgZXZ0KSB7XG5cbiAgICAgICAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTsgIC8vcHJldmVudHMgdXNlciBzZWxlY3Rpb24gb2YgcmVuZGVyZWQgbm9kZXMgZHVyaW5nIGRyYWdcblxuICAgICAgICBpZiAoZHJhZ29uLmRyb3ApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByZWN0ID0gdGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgICBkcmFnb24ucmVjdCA9IHJlY3QgPSB7XG4gICAgICAgICAgICBsZWZ0OiAgIE1hdGgucm91bmQocmVjdC5sZWZ0IC0gMSksXG4gICAgICAgICAgICB0b3A6ICAgIE1hdGgucm91bmQocmVjdC50b3AgLSAxKSxcbiAgICAgICAgICAgIHJpZ2h0OiAgTWF0aC5yb3VuZChyZWN0LnJpZ2h0KSxcbiAgICAgICAgICAgIGJvdHRvbTogTWF0aC5yb3VuZChyZWN0LmJvdHRvbSksXG4gICAgICAgICAgICB3aWR0aDogIE1hdGgucm91bmQocmVjdC53aWR0aCksXG4gICAgICAgICAgICBoZWlnaHQ6IE1hdGgucm91bmQocmVjdC5oZWlnaHQpXG4gICAgICAgIH07XG5cbiAgICAgICAgZHJhZ29uLnBpbiA9IHtcbiAgICAgICAgICAgIHg6IHdpbmRvdy5zY3JvbGxYICsgZXZ0LmNsaWVudFgsXG4gICAgICAgICAgICB5OiB3aW5kb3cuc2Nyb2xsWSArIGV2dC5jbGllbnRZXG4gICAgICAgIH07XG5cbiAgICAgICAgZHJhZ29uLm9yaWdpbiA9IGRyYWdvbi5pdGVtQ29vcmRpbmF0ZXModGhpcyk7XG5cbiAgICAgICAgaWYgKGRyYWdvbi5jYWxsYmFjay5ncmFiYmVkKSB7XG4gICAgICAgICAgICBkcmFnb24uY2FsbGJhY2suZ3JhYmJlZC5jYWxsKHRoaXMsIGRyYWdvbik7XG4gICAgICAgIH1cblxuICAgICAgICBkcmFnb24uZ2V0QWxsSXRlbUJvdW5kaW5nUmVjdHMoKTtcblxuICAgICAgICBkcmFnb24uZHJvcCA9IHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nO1xuICAgICAgICBkcmFnb24uZHJvcC5zdHlsZS50cmFuc2l0aW9uRHVyYXRpb24gPSAnMHMnO1xuICAgICAgICBkcmFnb24uZHJvcC5zdHlsZS5ib3JkZXJUb3BXaWR0aCA9IHJlY3QuaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgICB0aGlzLnN0eWxlLndpZHRoID0gcmVjdC53aWR0aCArICdweCc7XG4gICAgICAgIHRoaXMuc3R5bGUudHJhbnNpdGlvbkR1cmF0aW9uID0gJzBzJztcbiAgICAgICAgdGhpcy5zdHlsZVt0cmFuc2Zvcm1dID0gdHJhbnNsYXRlKFxuICAgICAgICAgICAgcmVjdC5sZWZ0IC0gd2luZG93LnNjcm9sbFgsXG4gICAgICAgICAgICByZWN0LnRvcCAgLSB3aW5kb3cuc2Nyb2xsWVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmNsYXNzTGlzdC5hZGQoJ2RyYWdvbi1wb3AnKTtcbiAgICAgICAgdGhpcy5zdHlsZS56SW5kZXggPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkcmFnb24ubW9kZWxMaXN0c1swXS5jb250YWluZXIucGFyZW50RWxlbWVudCkuekluZGV4O1xuXG4gICAgICAgIGlmICghZHJhZ29uLmNvbnRhaW5lcikge1xuICAgICAgICAgICAgLy8gd2FsayBiYWNrIHRvIGNsb3Nlc3Qgc2hhZG93IHJvb3QgT1IgYm9keSB0YWcgT1Igcm9vdCB0YWdcbiAgICAgICAgICAgIHZhciBjb250YWluZXIgPSB0aGlzO1xuICAgICAgICAgICAgd2hpbGUgKGNvbnRhaW5lci5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyID0gY29udGFpbmVyLnBhcmVudE5vZGU7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICB0eXBlb2YgU2hhZG93Um9vdCAhPT0gJ3VuZGVmaW5lZCcgJiYgY29udGFpbmVyIGluc3RhbmNlb2YgU2hhZG93Um9vdCB8fFxuICAgICAgICAgICAgICAgICAgICBjb250YWluZXIudGFnTmFtZSA9PT0gJ0JPRFknXG4gICAgICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZHJhZ29uLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICAgICAgfVxuXG4gICAgICAgIGRyYWdvbi5jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcyk7XG5cbiAgICAgICAgcmVjdC5sZWZ0ICAgKz0gd2luZG93LnNjcm9sbFg7XG4gICAgICAgIHJlY3QudG9wICAgICs9IHdpbmRvdy5zY3JvbGxZO1xuICAgICAgICByZWN0LnJpZ2h0ICArPSB3aW5kb3cuc2Nyb2xsWDtcbiAgICAgICAgcmVjdC5ib3R0b20gKz0gd2luZG93LnNjcm9sbFk7XG5cbiAgICAgICAgZHJhZ29uLmFkZEV2dCh0aGlzLCAnbW91c2Vtb3ZlJyk7XG4gICAgICAgIGRyYWdvbi5hZGRFdnQodGhpcywgJ21vdXNldXAnKTtcbiAgICB9LFxuXG4gICAgbW91c2Vtb3ZlOiBmdW5jdGlvbiAoZHJhZ29uLCBldnQpIHtcbiAgICAgICAgZHJhZ29uLmRyb3Auc3R5bGUudHJhbnNpdGlvbiA9IFJFVkVSVF9UT19TVFlMRVNIRUVUX1ZBTFVFO1xuXG4gICAgICAgIHZhciBob3Zlckxpc3QgPSBkcmFnb24ucG9pbnRJbkxpc3RSZWN0cyh7IHg6IGV2dC5jbGllbnRYLCB5OiBldnQuY2xpZW50WSB9KSB8fCBkcmFnb24ubW9zdFJlY2VudEhvdmVyTGlzdDtcblxuICAgICAgICBpZiAoaG92ZXJMaXN0KSB7XG4gICAgICAgICAgICB2YXIgZHggPSBldnQuY2xpZW50WCAtIGRyYWdvbi5waW4ueCxcbiAgICAgICAgICAgICAgICBkeSA9IGV2dC5jbGllbnRZIC0gZHJhZ29uLnBpbi55O1xuXG4gICAgICAgICAgICBkcmFnb24ubW9zdFJlY2VudEhvdmVyTGlzdCA9IGhvdmVyTGlzdDtcblxuICAgICAgICAgICAgdmFyIG1heFNjcm9sbFkgPSBob3Zlckxpc3QuZWxlbWVudC5zY3JvbGxIZWlnaHQgLSBob3Zlckxpc3QucmVjdC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgeSA9IGV2dC5jbGllbnRZICsgd2luZG93LnNjcm9sbFksXG4gICAgICAgICAgICAgICAgbWFnbml0dWRlO1xuXG4gICAgICAgICAgICBpZiAobWF4U2Nyb2xsWSA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBsaXN0IGlzIHNjcm9sbGFibGUgKGlzIHRhbGxlciB0aGFuIHJlY3QpXG4gICAgICAgICAgICAgICAgaWYgKGhvdmVyTGlzdC5lbGVtZW50LnNjcm9sbFRvcCA+IDAgJiYgKG1hZ25pdHVkZSA9IHkgLSAoaG92ZXJMaXN0LnJlY3QudG9wICsgNSkpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBtb3VzZSBuZWFyIG9yIGFib3ZlIHRvcCBhbmQgbGlzdCBpcyBub3Qgc2Nyb2xsZWQgdG8gdG9wIHlldFxuICAgICAgICAgICAgICAgICAgICByZXNldEF1dG9TY3JvbGxUaW1lcihtYWduaXR1ZGUsIDAsIGhvdmVyTGlzdC5lbGVtZW50KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGhvdmVyTGlzdC5lbGVtZW50LnNjcm9sbFRvcCA8IG1heFNjcm9sbFkgJiYgKG1hZ25pdHVkZSA9IHkgLSAoaG92ZXJMaXN0LnJlY3QuYm90dG9tIC0gMSAtIDUpKSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbW91c2UgbmVhciBvciBiZWxvdyBib3R0b20gYW5kIGxpc3Qgbm90IHNjcm9sbGVkIHRvIGJvdHRvbSB5ZXRcbiAgICAgICAgICAgICAgICAgICAgcmVzZXRBdXRvU2Nyb2xsVGltZXIobWFnbml0dWRlLCBtYXhTY3JvbGxZLCBob3Zlckxpc3QuZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbW91c2UgaW5zaWRlXG4gICAgICAgICAgICAgICAgICAgIHJlc2V0QXV0b1Njcm9sbFRpbWVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgb3RoZXIgPSBkcmFnb24ucG9pbnRJbkl0ZW1SZWN0cyh7XG4gICAgICAgICAgICAgICAgeDogZXZ0LmNsaWVudFgsXG4gICAgICAgICAgICAgICAgeTogZHJhZ29uLnJlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyBkeSArIGhvdmVyTGlzdC5lbGVtZW50LnNjcm9sbFRvcFxuICAgICAgICAgICAgfSwgdGhpcywgZHJhZ29uLmRyb3ApO1xuXG4gICAgICAgICAgICB0aGlzLnN0eWxlW3RyYW5zZm9ybV0gPSB0cmFuc2xhdGUoXG4gICAgICAgICAgICAgICAgZHJhZ29uLnJlY3QubGVmdCAtIHdpbmRvdy5zY3JvbGxYICsgZHgsXG4gICAgICAgICAgICAgICAgZHJhZ29uLnJlY3QudG9wIC0gd2luZG93LnNjcm9sbFkgKyBkeVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKG90aGVyKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVsZW1lbnQgPSBvdGhlci5lbGVtZW50O1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUudHJhbnNpdGlvbiA9IFJFVkVSVF9UT19TVFlMRVNIRUVUX1ZBTFVFO1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuc3R5bGUuYm9yZGVyVG9wV2lkdGggPSBkcmFnb24uZHJvcC5zdHlsZS5ib3JkZXJUb3BXaWR0aDtcbiAgICAgICAgICAgICAgICBkcmFnb24uZHJvcC5zdHlsZS5ib3JkZXJUb3BXaWR0aCA9IG51bGw7XG4gICAgICAgICAgICAgICAgZHJhZ29uLmRyb3AgPSBlbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIG1vdXNldXA6IGZ1bmN0aW9uIChkcmFnb24sIGV2dCkge1xuICAgICAgICByZXNldEF1dG9TY3JvbGxUaW1lcigpO1xuICAgICAgICBkcmFnb24ucmVtb3ZlRXZ0KCdtb3VzZW1vdmUnKTtcbiAgICAgICAgZHJhZ29uLnJlbW92ZUV2dCgnbW91c2V1cCcpO1xuXG4gICAgICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgICB2YXIgbmV3UmVjdCA9IHRoaXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgd2luZG93LnNjcm9sbFggKyBuZXdSZWN0LmxlZnQgPT09IGRyYWdvbi5yZWN0LmxlZnQgJiZcbiAgICAgICAgICAgIHdpbmRvdy5zY3JvbGxZICsgbmV3UmVjdC50b3AgPT09IGRyYWdvbi5yZWN0LnRvcFxuICAgICAgICApIHtcbiAgICAgICAgICAgIGRyYWdvbi5yZWluc2VydCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkcm9wUmVjdCA9IGRyYWdvbi5kcm9wLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgICAgICBkcmFnb24uYWRkRXZ0KHRoaXMsICd0cmFuc2l0aW9uZW5kJywgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN0eWxlLnRyYW5zaXRpb25EdXJhdGlvbiA9IFJFVkVSVF9UT19TVFlMRVNIRUVUX1ZBTFVFOyAvL3JldmVydHMgdG8gMjAwbXNcbiAgICAgICAgICAgIHRoaXMuc3R5bGUudHJhbnNpdGlvblByb3BlcnR5ID0gdHJhbnNmb3JtO1xuICAgICAgICAgICAgdGhpcy5zdHlsZVt0cmFuc2Zvcm1dID0gdHJhbnNsYXRlKFxuICAgICAgICAgICAgICAgIGRyb3BSZWN0LmxlZnQgLSB3aW5kb3cuc2Nyb2xsWCxcbiAgICAgICAgICAgICAgICBkcm9wUmVjdC50b3AgLSB3aW5kb3cuc2Nyb2xsWVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICB0cmFuc2l0aW9uZW5kOiBmdW5jdGlvbiAoZHJhZ29uLCBldnQpIHtcbiAgICAgICAgaWYgKGV2dC5wcm9wZXJ0eU5hbWUgPT09IHRyYW5zZm9ybSkge1xuICAgICAgICAgICAgZHJhZ29uLnJlbW92ZUV2dCgndHJhbnNpdGlvbmVuZCcpO1xuICAgICAgICAgICAgZHJhZ29uLnJlaW5zZXJ0KHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLnN0eWxlLnRyYW5zaXRpb25Qcm9wZXJ0eSA9IFJFVkVSVF9UT19TVFlMRVNIRUVUX1ZBTFVFOyAvL3JldmVydHMgdG8gYm9yZGVyLXRvcC13aWR0aFxuXG4gICAgICAgICAgICB2YXIgb3JpZ2luTGlzdCA9IGRyYWdvbi5tb2RlbExpc3RzW2RyYWdvbi5vcmlnaW4ubGlzdF07XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSBvcmlnaW5MaXN0LnNwbGljZShkcmFnb24ub3JpZ2luLml0ZW0sIDEpWzBdO1xuICAgICAgICAgICAgdmFyIGRlc3RpbmF0aW9uID0gZHJhZ29uLml0ZW1Db29yZGluYXRlcyh0aGlzKTtcbiAgICAgICAgICAgIHZhciBkZXN0aW5hdGlvbkxpc3QgPSBkcmFnb24ubW9kZWxMaXN0c1tkZXN0aW5hdGlvbi5saXN0XTtcbiAgICAgICAgICAgIHZhciBpbnRlckxpc3REcm9wID0gb3JpZ2luTGlzdCAhPT0gZGVzdGluYXRpb25MaXN0O1xuICAgICAgICAgICAgdmFyIGxpc3RDaGFuZ2VkID0gaW50ZXJMaXN0RHJvcCB8fCBkcmFnb24ub3JpZ2luLml0ZW0gIT09IGRlc3RpbmF0aW9uLml0ZW07XG4gICAgICAgICAgICBkZXN0aW5hdGlvbkxpc3Quc3BsaWNlKGRlc3RpbmF0aW9uLml0ZW0sIDAsIG1vZGVsKTtcblxuICAgICAgICAgICAgaWYgKGxpc3RDaGFuZ2VkKSB7XG4gICAgICAgICAgICAgICAgb3JpZ2luTGlzdC5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdsaXN0Y2hhbmdlZCcpKTtcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJMaXN0RHJvcCkge1xuICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbkxpc3QuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnbGlzdGNoYW5nZWQnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZHJhZ29uLmNhbGxiYWNrLmRyb3BwZWQpIHtcbiAgICAgICAgICAgICAgICBkcmFnb24uY2FsbGJhY2suZHJvcHBlZC5jYWxsKHRoaXMsIGRyYWdvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5mdW5jdGlvbiByZXNldEF1dG9TY3JvbGxUaW1lcihtYWduaXR1ZGUsIGxpbWl0LCBlbGVtZW50KSB7XG4gICAgaWYgKCFtYWduaXR1ZGUpIHtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgIHNjcm9sbFZlbG9jaXR5ID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY2hhbmdlRGlyZWN0aW9uID1cbiAgICAgICAgICAgIHNjcm9sbFZlbG9jaXR5ICA8ICAwICYmIG1hZ25pdHVkZSAgPj0gMCB8fFxuICAgICAgICAgICAgc2Nyb2xsVmVsb2NpdHkgPT09IDAgJiYgbWFnbml0dWRlICE9PSAwIHx8XG4gICAgICAgICAgICBzY3JvbGxWZWxvY2l0eSAgPiAgMCAmJiBtYWduaXR1ZGUgIDw9IDA7XG4gICAgICAgIHNjcm9sbFZlbG9jaXR5ID0gbWFnbml0dWRlID4gMCA/IE1hdGgubWluKDUwLCBtYWduaXR1ZGUpIDogTWF0aC5tYXgoLTUwLCBtYWduaXR1ZGUpO1xuICAgICAgICBpZiAoY2hhbmdlRGlyZWN0aW9uKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICAgICAgICAgIHRpbWVyID0gc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKGxpbWl0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHNjcm9sbFRvcCA9IGVsZW1lbnQuc2Nyb2xsVG9wICsgc2Nyb2xsVmVsb2NpdHk7XG4gICAgICAgICAgICAgICAgaWYgKHNjcm9sbFZlbG9jaXR5IDwgMCAmJiBzY3JvbGxUb3AgPCBsaW1pdCB8fCBzY3JvbGxWZWxvY2l0eSA+IDAgJiYgc2Nyb2xsVG9wID4gbGltaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zY3JvbGxUb3AgPSBsaW1pdDtcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5zY3JvbGxUb3AgPSBzY3JvbGxUb3A7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMTI1KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gdG9BcnJheShhcnJheUxpa2VPYmplY3QpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJyYXlMaWtlT2JqZWN0KTtcbn1cblxuZnVuY3Rpb24gcG9pbnRJblJlY3QocG9pbnQsIHJlY3QpIHtcbiAgICByZXR1cm4gcmVjdC50b3AgPD0gcG9pbnQueSAmJiBwb2ludC55IDw9IHJlY3QuYm90dG9tXG4gICAgICAgICYmIHJlY3QubGVmdCA8PSBwb2ludC54ICYmIHBvaW50LnggPD0gcmVjdC5yaWdodDtcbn1cblxuZnVuY3Rpb24gdHJhbnNsYXRlKGxlZnQsIHRvcCkge1xuICAgIHJldHVybiAndHJhbnNsYXRlKCdcbiAgICAgICAgKyBNYXRoLmZsb29yKGxlZnQgKyB3aW5kb3cuc2Nyb2xsWCkgKyAncHgsJ1xuICAgICAgICArIE1hdGguZmxvb3IodG9wICsgd2luZG93LnNjcm9sbFkpICsgJ3B4KSc7XG59XG5cbmZ1bmN0aW9uIGh0bWxFbmNvZGUoc3RyaW5nKSB7XG4gICAgdmFyIHRleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoc3RyaW5nKTtcblxuICAgIHJldHVybiBkb2N1bWVudFxuICAgICAgICAuY3JlYXRlRWxlbWVudCgnYScpXG4gICAgICAgIC5hcHBlbmRDaGlsZCh0ZXh0Tm9kZSlcbiAgICAgICAgLnBhcmVudE5vZGVcbiAgICAgICAgLmlubmVySFRNTDtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGA8dWw+Li4uPC91bD5gIGVsZW1lbnRzIGFuZCBpbnNlcnRzIHRoZW0gaW50byBhbiBgZWxlbWVudGAgcHJvcGVydHkgb24gZWFjaCBtb2RlbC5cbiAqIEBwYXJhbSB7b2JqZWN0fSBtb2RlbExpc3RzXG4gKiBAcmV0dXJucyBgbW9kZWxMaXN0c2BcbiAqL1xuZnVuY3Rpb24gY3JlYXRlTGlzdEVsZW1lbnRzRnJvbU1vZGVsTGlzdHMobW9kZWxMaXN0cywgb3B0aW9ucykge1xuICAgIHZhciB0ZW1wbGF0ZUxhYmVsID0gb3B0aW9ucy5sYWJlbCB8fCAne2xhYmVsfSc7XG5cbiAgICBtb2RlbExpc3RzLmZvckVhY2goZnVuY3Rpb24gKG1vZGVsTGlzdCwgbGlzdEluZGV4KSB7XG4gICAgICAgIHZhciBsaXN0TGFiZWwgPSBtb2RlbExpc3QubGFiZWwgfHwgdGVtcGxhdGVMYWJlbCxcbiAgICAgICAgICAgIGxpc3RIdG1sRW5jb2RlID0gbW9kZWxMaXN0Lmh0bWxFbmNvZGUgIT09IHVuZGVmaW5lZCAmJiBtb2RlbExpc3QuaHRtbEVuY29kZSB8fCBvcHRpb25zLmh0bWxFbmNvZGUsXG4gICAgICAgICAgICBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgICAgICAgIGxpc3RFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcblxuICAgICAgICBpZiAobW9kZWxMaXN0Lm1vZGVscykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWxMaXN0KS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoa2V5ICE9PSAnbW9kZWxzJykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbExpc3QubW9kZWxzW2tleV0gPSBtb2RlbExpc3Rba2V5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIG1vZGVsTGlzdHNbbGlzdEluZGV4XSA9IG1vZGVsTGlzdCA9IG1vZGVsTGlzdC5tb2RlbHM7XG4gICAgICAgIH0gZWxzZSBpZiAobW9kZWxMaXN0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIG1vZGVsTGlzdC5tb2RlbHMgPSBtb2RlbExpc3Q7IC8vIHBvaW50IHRvIHNlbGZcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycm9yKCdMaXN0IFt7MX1dIG5vdCBhbiBhcnJheSBvZiBtb2RlbHMgKHdpdGggb3Igd2l0aG91dCBhZGRpdGlvbmFsIHByb3BlcnRpZXMpIE9SICcgK1xuICAgICAgICAgICAgICAgICdhbiBvYmplY3QgKHdpdGggYSBgbW9kZWxzYCBwcm9wZXJ0eSBjb250YWluaW5nIGFuIGFycmF5IG9mIG1vZGVscykuJywgbGlzdEluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1vZGVsTGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChtb2RlbCkge1xuICAgICAgICAgICAgdmFyIG1vZGVsTGFiZWwgPSBtb2RlbC5sYWJlbCB8fCBsaXN0TGFiZWwsXG4gICAgICAgICAgICAgICAgbW9kZWxIdG1sRW5jb2RlID0gbW9kZWwuaHRtbEVuY29kZSAhPT0gdW5kZWZpbmVkICYmIG1vZGVsLmh0bWxFbmNvZGUgfHwgbGlzdEh0bWxFbmNvZGUsXG4gICAgICAgICAgICAgICAgbW9kZWxPYmplY3QgPSB0eXBlb2YgbW9kZWwgPT09ICdvYmplY3QnID8gbW9kZWwgOiB7IGxhYmVsOiBtb2RlbH0sXG4gICAgICAgICAgICAgICAgbGFiZWwgPSBmb3JtYXQuY2FsbChbbW9kZWxPYmplY3QsIG1vZGVsTGlzdCwgb3B0aW9uc10sIG1vZGVsTGFiZWwpLFxuICAgICAgICAgICAgICAgIGl0ZW1FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcblxuICAgICAgICAgICAgaXRlbUVsZW1lbnQuaW5uZXJIVE1MID0gbW9kZWxIdG1sRW5jb2RlID8gaHRtbEVuY29kZShsYWJlbCkgOiBsYWJlbDtcblxuICAgICAgICAgICAgbGlzdEVsZW1lbnQuYXBwZW5kQ2hpbGQoaXRlbUVsZW1lbnQpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBhcHBlbmQgdGhlIGZpbmFsIFwiZmVuY2Vwb3N0XCIgaXRlbSAtLSBkcm9wIHRhcmdldCBhdCBib3R0b20gb2YgbGlzdCBhZnRlciBhbGwgaXRlbXNcbiAgICAgICAgdmFyIGl0ZW1FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICAgICAgaXRlbUVsZW1lbnQuaW5uZXJIVE1MID0gJyZuYnNwOyc7XG4gICAgICAgIGxpc3RFbGVtZW50LmFwcGVuZENoaWxkKGl0ZW1FbGVtZW50KTtcblxuICAgICAgICAvLyBhcHBlbmQgaGVhZGVyIHRvIGNvbnRhaW5lclxuICAgICAgICBpZiAobW9kZWxMaXN0LnRpdGxlKSB7XG4gICAgICAgICAgICB2YXIgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBoZWFkZXIuaW5uZXJIVE1MID0gbGlzdEh0bWxFbmNvZGUgPyBodG1sRW5jb2RlKG1vZGVsTGlzdC50aXRsZSkgOiBtb2RlbExpc3QudGl0bGU7XG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChsaXN0RWxlbWVudCk7XG4gICAgICAgIGNvbnRhaW5lci5jbGFzc05hbWUgPSBtb2RlbExpc3QuY3NzQ2xhc3NOYW1lcyB8fCBvcHRpb25zLmNzc0NsYXNzTmFtZXMgfHwgJ2RyYWdvbi1saXN0JztcbiAgICAgICAgbW9kZWxMaXN0LmVsZW1lbnQgPSBsaXN0RWxlbWVudDtcbiAgICAgICAgbW9kZWxMaXN0LmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcbiAgICB9KTtcblxuICAgIHJldHVybiBtb2RlbExpc3RzO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGAubW9kZWxMaXN0c2AgYXJyYXkgd2l0aCB0aGVzZSA8bGk+IGVsZW1lbnRzJyBwYXJlbnQgPHVsPiBlbGVtZW50c1xuICogQHBhcmFtIHtFbGVtZW50W119IGxpc3RJdGVtRWxlbWVudHNcbiAqIEByZXR1cm5zIHtBcnJheX1cbiAqL1xuZnVuY3Rpb24gY3JlYXRlTW9kZWxMaXN0c0Zyb21MaXN0RWxlbWVudHMobGlzdEl0ZW1FbGVtZW50cykge1xuICAgIHZhciBtb2RlbExpc3RzID0gW107XG5cbiAgICBsaXN0SXRlbUVsZW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW1FbGVtZW50KSB7XG4gICAgICAgIHZhciBsaXN0RWxlbWVudCA9IGl0ZW1FbGVtZW50LnBhcmVudEVsZW1lbnQsXG4gICAgICAgICAgICBjb250YWluZXIgPSBsaXN0RWxlbWVudC5wYXJlbnRFbGVtZW50LFxuICAgICAgICAgICAgbW9kZWxzID0gW107XG4gICAgICAgIGlmICghbW9kZWxMaXN0cy5maW5kKGZ1bmN0aW9uIChsaXN0KSB7IHJldHVybiBsaXN0LmVsZW1lbnQgPT09IGxpc3RFbGVtZW50OyB9KSkge1xuICAgICAgICAgICAgdG9BcnJheShsaXN0RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCdsaScpKS5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGlmIChpdGVtRWxlbWVudCAhPT0gbGlzdEVsZW1lbnQubGFzdEVsZW1lbnRDaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbHMucHVzaChpdGVtRWxlbWVudC5pbm5lckhUTUwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgbW9kZWxzLmVsZW1lbnQgPSBsaXN0RWxlbWVudDtcbiAgICAgICAgICAgIG1vZGVscy5jb250YWluZXIgPSBjb250YWluZXI7XG4gICAgICAgICAgICBtb2RlbExpc3RzLnB1c2gobW9kZWxzKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1vZGVsTGlzdHM7XG59XG5cbmZ1bmN0aW9uIGNhcHR1cmVFdmVudChldnQpIHtcbiAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG59XG5cbmZ1bmN0aW9uIGVycm9yKCkge1xuICAgIHJldHVybiAnbGlzdC1kcmFnb246ICcgKyBmb3JtYXQuYXBwbHkodGhpcywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XG59XG5cbi8vIHRoaXMgaW50ZXJmYWNlIGNvbnNpc3RzIHNvbGVseSBvZiB0aGUgcHJvdG90eXBhbCBvYmplY3QgY29uc3RydWN0b3Jcbm1vZHVsZS5leHBvcnRzID0gTGlzdERyYWdvbjtcbiIsIi8qIG9iamVjdC1pdGVyYXRvcnMuanMgLSBNaW5pIFVuZGVyc2NvcmUgbGlicmFyeVxuICogYnkgSm9uYXRoYW4gRWl0ZW5cbiAqXG4gKiBUaGUgbWV0aG9kcyBiZWxvdyBvcGVyYXRlIG9uIG9iamVjdHMgKGJ1dCBub3QgYXJyYXlzKSBzaW1pbGFybHlcbiAqIHRvIFVuZGVyc2NvcmUgKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNjb2xsZWN0aW9ucykuXG4gKlxuICogRm9yIG1vcmUgaW5mb3JtYXRpb246XG4gKiBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L29iamVjdC1pdGVyYXRvcnNcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3Igb25lIG1ldGhvZCBjYWxsLlxuICogQERlc2MgTm90ZSB0aGF0IHRoZSBgbmV3YCBrZXl3b3JkIGlzIG5vdCBuZWNlc3NhcnkuXG4gKiBAcGFyYW0ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gb2JqZWN0IC0gYG51bGxgIG9yIGB1bmRlZmluZWRgIGlzIHRyZWF0ZWQgYXMgYW4gZW1wdHkgcGxhaW4gb2JqZWN0LlxuICogQHJldHVybiB7V3JhcHBlcn0gVGhlIHdyYXBwZWQgb2JqZWN0LlxuICovXG5mdW5jdGlvbiBXcmFwcGVyKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBXcmFwcGVyKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBXcmFwcGVyKSkge1xuICAgICAgICByZXR1cm4gbmV3IFdyYXBwZXIob2JqZWN0KTtcbiAgICB9XG4gICAgdGhpcy5vcmlnaW5hbFZhbHVlID0gb2JqZWN0O1xuICAgIHRoaXMubyA9IG9iamVjdCB8fCB7fTtcbn1cblxuLyoqXG4gKiBAbmFtZSBXcmFwcGVyLmNoYWluXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3IgYSBjaGFpbiBvZiBtZXRob2QgY2FsbHMuXG4gKiBARGVzYyBDYWxscyB0aGUgY29uc3RydWN0b3IgYFdyYXBwZXIoKWAgYW5kIG1vZGlmaWVzIHRoZSB3cmFwcGVyIGZvciBjaGFpbmluZy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm4ge1dyYXBwZXJ9IFRoZSB3cmFwcGVkIG9iamVjdC5cbiAqL1xuV3JhcHBlci5jaGFpbiA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIgd3JhcHBlZCA9IFdyYXBwZXIob2JqZWN0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgd3JhcHBlZC5jaGFpbmluZyA9IHRydWU7XG4gICAgcmV0dXJuIHdyYXBwZWQ7XG59O1xuXG5XcmFwcGVyLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBVbndyYXAgYW4gb2JqZWN0IHdyYXBwZWQgd2l0aCB7QGxpbmsgV3JhcHBlci5jaGFpbnxXcmFwcGVyLmNoYWluKCl9LlxuICAgICAqIEByZXR1cm4ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gVGhlIHZhbHVlIG9yaWdpbmFsbHkgd3JhcHBlZCBieSB0aGUgY29uc3RydWN0b3IuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3JpZ2luYWxWYWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbZWFjaF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2VhY2gpIG1ldGhvZDogSXRlcmF0ZSBvdmVyIHRoZSBtZW1iZXJzIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgY2FsbGluZyBgaXRlcmF0ZWUoKWAgd2l0aCBlYWNoLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6IGAodmFsdWUsIGtleSwgb2JqZWN0KWAuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyB1bmRlZmluZWQ7IGFuIGAuZWFjaGAgbG9vcCBjYW5ub3QgYmUgYnJva2VuIG91dCBvZiAodXNlIHtAbGluayBXcmFwcGVyI2ZpbmR8LmZpbmR9IGluc3RlYWQpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHtXcmFwcGVyfSBUaGUgd3JhcHBlZCBvYmplY3QgZm9yIGNoYWluaW5nLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGVhY2g6IGZ1bmN0aW9uIChpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpdGVyYXRlZS5jYWxsKHRoaXMsIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2ZpbmRdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaW5kKSBtZXRob2Q6IExvb2sgdGhyb3VnaCBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHJldHVybmluZyB0aGUgZmlyc3Qgb25lIHRoYXQgcGFzc2VzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBgdW5kZWZpbmVkYCBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiByZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgYWNjZXB0YWJsZSBtZW1iZXIsIGFuZCBkb2Vzbid0IG5lY2Vzc2FyaWx5IHRyYXZlcnNlIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IFRoZSBmb3VuZCBwcm9wZXJ0eSdzIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpbmQ6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBPYmplY3Qua2V5cyhvKS5maW5kKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlZGljYXRlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pO1xuICAgICAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG9bcmVzdWx0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtmaWx0ZXJdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaWx0ZXIpIG1ldGhvZDogTG9vayB0aHJvdWdoIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgcmV0dXJuaW5nIHRoZSB2YWx1ZXMgb2YgYWxsIG1lbWJlcnMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBlbXB0eSBhcnJheSBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiBhbHdheXMgdHJhdmVyc2VzIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGZpbHRlcmVkIHZhbHVlcy5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBmaWx0ZXI6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChwcmVkaWNhdGUuY2FsbCh0aGlzLCBvW2tleV0sIGtleSwgbykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gob1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjb250ZXh0IHx8IG8pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW21hcF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI21hcCkgbWV0aG9kOiBQcm9kdWNlcyBhIG5ldyBhcnJheSBvZiB2YWx1ZXMgYnkgbWFwcGluZyBlYWNoIHZhbHVlIGluIGxpc3QgdGhyb3VnaCBhIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIChgaXRlcmF0ZWVgKS4gVGhlIGZ1bmN0aW9uIGFsd2F5cyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gaXRlcmF0ZWUgLSBGb3IgZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRocmVlIGFyZ3VtZW50czogYCh2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbmNhdGVuYXRlZCB0byB0aGUgZW5kIG9mIHRoZSBuZXcgYXJyYXkuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIHRoaXMgb2JqZWN0LiBJbiBvdGhlciB3b3JkcywgdGhpcyBvYmplY3QgYmVjb21lcyB0aGUgYHRoaXNgIHZhbHVlIGluIHRoZSBjYWxscyB0byBgcHJlZGljYXRlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFwOiBmdW5jdGlvbiAoaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGl0ZXJhdGVlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbcmVkdWNlXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jcmVkdWNlKSBtZXRob2Q6IEJvaWwgZG93biB0aGUgdmFsdWVzIG9mIGFsbCB0aGUgbWVtYmVycyBvZiB0aGUgd3JhcHBlZCBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZS4gYG1lbW9gIGlzIHRoZSBpbml0aWFsIHN0YXRlIG9mIHRoZSByZWR1Y3Rpb24sIGFuZCBlYWNoIHN1Y2Nlc3NpdmUgc3RlcCBvZiBpdCBzaG91bGQgYmUgcmV0dXJuZWQgYnkgYGl0ZXJhdGVlKClgLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBmb3VyIGFyZ3VtZW50czogYChtZW1vLCB2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGJlY29tZXMgdGhlIG5ldyB2YWx1ZSBvZiBgbWVtb2AgZm9yIHRoZSBuZXh0IGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFttZW1vXSAtIElmIG5vIG1lbW8gaXMgcGFzc2VkIHRvIHRoZSBpbml0aWFsIGludm9jYXRpb24gb2YgcmVkdWNlLCB0aGUgaXRlcmF0ZWUgaXMgbm90IGludm9rZWQgb24gdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGxpc3QuIFRoZSBmaXJzdCBlbGVtZW50IGlzIGluc3RlYWQgcGFzc2VkIGFzIHRoZSBtZW1vIGluIHRoZSBpbnZvY2F0aW9uIG9mIHRoZSBpdGVyYXRlZSBvbiB0aGUgbmV4dCBlbGVtZW50IGluIHRoZSBsaXN0LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgdmFsdWUgb2YgYG1lbW9gIFwicmVkdWNlZFwiIGFzIHBlciBgaXRlcmF0ZWVgLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHJlZHVjZTogZnVuY3Rpb24gKGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBvID0gdGhpcy5vO1xuICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5LCBpZHgpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gKCFpZHggJiYgbWVtbyA9PT0gdW5kZWZpbmVkKSA/IG9ba2V5XSA6IGl0ZXJhdGVlKG1lbW8sIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2V4dGVuZF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2V4dGVuZCkgbWV0aG9kOiBDb3B5IGFsbCBvZiB0aGUgcHJvcGVydGllcyBpbiBlYWNoIG9mIHRoZSBgc291cmNlYCBvYmplY3QgcGFyYW1ldGVyKHMpIG92ZXIgdG8gdGhlICh3cmFwcGVkKSBkZXN0aW5hdGlvbiBvYmplY3QgKHRodXMgbXV0YXRpbmcgaXQpLiBJdCdzIGluLW9yZGVyLCBzbyB0aGUgcHJvcGVydGllcyBvZiB0aGUgbGFzdCBgc291cmNlYCBvYmplY3Qgd2lsbCBvdmVycmlkZSBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZSBpbiBwcmV2aW91cyBhcmd1bWVudHMgb3IgaW4gdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiA+IFRoaXMgbWV0aG9kIGNvcGllcyBvd24gbWVtYmVycyBhcyB3ZWxsIGFzIG1lbWJlcnMgaW5oZXJpdGVkIGZyb20gcHJvdG90eXBlIGNoYWluLlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmQ6IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBvW2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtleHRlbmRPd25dKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNleHRlbmRPd24pIG1ldGhvZDogTGlrZSB7QGxpbmsgV3JhcHBlciNleHRlbmR8ZXh0ZW5kfSwgYnV0IG9ubHkgY29waWVzIGl0cyBcIm93blwiIHByb3BlcnRpZXMgb3ZlciB0byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmRPd246IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBXcmFwcGVyKG9iamVjdCkuZWFjaChmdW5jdGlvbiAodmFsLCBrZXkpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgICAgICAgICAgICAgb1trZXldID0gdmFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH1cbn07XG5cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2ZpbmRcbmlmICghQXJyYXkucHJvdG90eXBlLmZpbmQpIHtcbiAgICBBcnJheS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1leHRlbmQtbmF0aXZlXG4gICAgICAgIGlmICh0aGlzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcnJheS5wcm90b3R5cGUuZmluZCBjYWxsZWQgb24gbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZGljYXRlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBsaXN0ID0gT2JqZWN0KHRoaXMpO1xuICAgICAgICB2YXIgbGVuZ3RoID0gbGlzdC5sZW5ndGggPj4+IDA7XG4gICAgICAgIHZhciB0aGlzQXJnID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFsdWUgPSBsaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpLCBsaXN0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gV3JhcHBlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqIEBtb2R1bGUgb3ZlcnJpZGVyICovXG5cbi8qKlxuICogTWl4ZXMgbWVtYmVycyBvZiBhbGwgYHNvdXJjZXNgIGludG8gYHRhcmdldGAsIGhhbmRsaW5nIGdldHRlcnMgYW5kIHNldHRlcnMgcHJvcGVybHkuXG4gKlxuICogQW55IG51bWJlciBvZiBgc291cmNlc2Agb2JqZWN0cyBtYXkgYmUgZ2l2ZW4gYW5kIGVhY2ggaXMgY29waWVkIGluIHR1cm4uXG4gKlxuICogQGV4YW1wbGVcbiAqIHZhciBvdmVycmlkZXIgPSByZXF1aXJlKCdvdmVycmlkZXInKTtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEgfSwgc291cmNlMSA9IHsgYjogMiB9LCBzb3VyY2UyID0geyBjOiAzIH07XG4gKiB0YXJnZXQgPT09IG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZTEsIHNvdXJjZTIpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYSwgYiwgYW5kIGM7IHNvdXJjZSBvYmplY3RzIHVudG91Y2hlZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QgLSBUaGUgdGFyZ2V0IG9iamVjdCB0byByZWNlaXZlIHNvdXJjZXMuXG4gKiBAcGFyYW0gey4uLm9iamVjdH0gW3NvdXJjZXNdIC0gT2JqZWN0KHMpIGNvbnRhaW5pbmcgbWVtYmVycyB0byBjb3B5IHRvIGB0YXJnZXRgLiAoT21pdHRpbmcgaXMgYSBuby1vcC4pXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgdGFyZ2V0IG9iamVjdCAoYHRhcmdldGApXG4gKi9cbmZ1bmN0aW9uIG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZXMpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIG1peEluLmNhbGwodGFyZ2V0LCBhcmd1bWVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogTWl4IGB0aGlzYCBtZW1iZXJzIGludG8gYHRhcmdldGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEEuIFNpbXBsZSB1c2FnZSAodXNpbmcgLmNhbGwpOlxuICogdmFyIG1peEluVG8gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJblRvO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluVG8uY2FsbChzb3VyY2UsIHRhcmdldCk7IC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSBzb3VyY2UgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW5UbyA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluVG87XG4gKiB2YXIgdGFyZ2V0ID0geyBhOiAxIH0sIHNvdXJjZSA9IHsgYjogMiwgbWl4SW5UbzogbWl4SW5UbyB9O1xuICogdGFyZ2V0ID09PSBzb3VyY2UubWl4SW5Ubyh0YXJnZXQpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYm90aCBhIGFuZCBiOyBzb3VyY2Ugb2JqZWN0IHVudG91Y2hlZFxuICpcbiAqIEB0aGlzIHtvYmplY3R9IFRhcmdldC5cbiAqIEBwYXJhbSB0YXJnZXRcbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSB0YXJnZXQgb2JqZWN0IChgdGFyZ2V0YClcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluVG8odGFyZ2V0KSB7XG4gICAgdmFyIGRlc2NyaXB0b3I7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLCBrZXkpKSkge1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIE1peCBgc291cmNlYCBtZW1iZXJzIGludG8gYHRoaXNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBBLiBTaW1wbGUgdXNhZ2UgKHVzaW5nIC5jYWxsKTpcbiAqIHZhciBtaXhJbiA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluLmNhbGwodGFyZ2V0LCBzb3VyY2UpIC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSB0YXJnZXQgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW4gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJbjtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEsIG1peEluOiBtaXhJbiB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gdGFyZ2V0Lm1peEluKHNvdXJjZSkgLy8gdHJ1ZVxuICogLy8gdGFyZ2V0IG5vdyBoYXMgYm90aCBhIGFuZCBiIChhbmQgbWl4SW4pOyBzb3VyY2UgdW50b3VjaGVkXG4gKlxuICogQHBhcmFtIHNvdXJjZVxuICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QgKGB0aGlzYClcbiAqIEBtZW1iZXJPZiBvdmVycmlkZXJcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluKHNvdXJjZSkge1xuICAgIHZhciBkZXNjcmlwdG9yO1xuICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSkpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn1cblxub3ZlcnJpZGVyLm1peEluVG8gPSBtaXhJblRvO1xub3ZlcnJpZGVyLm1peEluID0gbWl4SW47XG5cbm1vZHVsZS5leHBvcnRzID0gb3ZlcnJpZGVyO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJFR0VYUF9JTkRJUkVDVElPTiA9IC9eKFxcdyspXFwoKFxcdyspXFwpJC87ICAvLyBmaW5kcyBjb21wbGV0ZSBwYXR0ZXJuIGEoYikgd2hlcmUgYm90aCBhIGFuZCBiIGFyZSByZWdleCBcIndvcmRzXCJcblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IHZhbHVlSXRlbVxuICogWW91IHNob3VsZCBzdXBwbHkgYm90aCBgbmFtZWAgYW5kIGBhbGlhc2AgYnV0IHlvdSBjb3VsZCBvbWl0IG9uZSBvciB0aGUgb3RoZXIgYW5kIHdoaWNoZXZlciB5b3UgcHJvdmlkZSB3aWxsIGJlIHVzZWQgZm9yIGJvdGguXG4gKiA+IElmIHlvdSBvbmx5IGdpdmUgdGhlIGBuYW1lYCBwcm9wZXJ0eSwgeW91IG1pZ2h0IGFzIHdlbGwganVzdCBnaXZlIGEgc3RyaW5nIGZvciB7QGxpbmsgbWVudUl0ZW19IHJhdGhlciB0aGFuIHRoaXMgb2JqZWN0LlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtuYW1lPWFsaWFzXSAtIFZhbHVlIG9mIGB2YWx1ZWAgYXR0cmlidXRlIG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYWxpYXM9bmFtZV0gLSBUZXh0IG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZV0gT25lIG9mIHRoZSBrZXlzIG9mIGB0aGlzLmNvbnZlcnRlcnNgLiBJZiBub3Qgb25lIG9mIHRoZXNlIChpbmNsdWRpbmcgYHVuZGVmaW5lZGApLCBmaWVsZCB2YWx1ZXMgd2lsbCBiZSB0ZXN0ZWQgd2l0aCBhIHN0cmluZyBjb21wYXJpc29uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBbaGlkZGVuPWZhbHNlXVxuICovXG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fG1lbnVJdGVtW119IHN1Ym1lbnVJdGVtXG4gKiBAc3VtbWFyeSBIaWVyYXJjaGljYWwgYXJyYXkgb2Ygc2VsZWN0IGxpc3QgaXRlbXMuXG4gKiBAZGVzYyBEYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgdGhlIGxpc3Qgb2YgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBhbmQgYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMgdGhhdCBtYWtlIHVwIGEgYDxzZWxlY3Q+Li4uPC9zZWxlY3Q+YCBlbGVtZW50LlxuICpcbiAqID4gQWx0ZXJuYXRlIGZvcm06IEluc3RlYWQgb2YgYW4gb2JqZWN0IHdpdGggYSBgbWVudWAgcHJvcGVydHkgY29udGFpbmluZyBhbiBhcnJheSwgbWF5IGl0c2VsZiBiZSB0aGF0IGFycmF5LiBCb3RoIGZvcm1zIGhhdmUgdGhlIG9wdGlvbmFsIGBsYWJlbGAgcHJvcGVydHkuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2xhYmVsXSAtIERlZmF1bHRzIHRvIGEgZ2VuZXJhdGVkIHN0cmluZyBvZiB0aGUgZm9ybSBcIkdyb3VwIG5bLm1dLi4uXCIgd2hlcmUgZWFjaCBkZWNpbWFsIHBvc2l0aW9uIHJlcHJlc2VudHMgYSBsZXZlbCBvZiB0aGUgb3B0Z3JvdXAgaGllcmFyY2h5LlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBzdWJtZW51XG4gKi9cblxuLyoqIEB0eXBlZGVmIHtzdHJpbmd8dmFsdWVJdGVtfHN1Ym1lbnVJdGVtfSBtZW51SXRlbVxuICogTWF5IGJlIG9uZSBvZiB0aHJlZSBwb3NzaWJsZSB0eXBlcyB0aGF0IHNwZWNpZnkgZWl0aGVyIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgb3IgYW4gYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnQgYXMgZm9sbG93czpcbiAqICogSWYgYSBgc3RyaW5nYCwgc3BlY2lmaWVzIHRoZSB0ZXh0IG9mIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgd2l0aCBubyBgdmFsdWVgIGF0dHJpYnV0ZS4gKEluIHRoZSBhYnNlbmNlIG9mIGEgYHZhbHVlYCBhdHRyaWJ1dGUsIHRoZSBgdmFsdWVgIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50IGRlZmF1bHRzIHRvIHRoZSB0ZXh0LilcbiAqICogSWYgc2hhcGVkIGxpa2UgYSB7QGxpbmsgdmFsdWVJdGVtfSBvYmplY3QsIHNwZWNpZmllcyBib3RoIHRoZSB0ZXh0IGFuZCB2YWx1ZSBvZiBhbiBgPG9wdGlvbi4uLi48L29wdGlvbj5gIGVsZW1lbnQuXG4gKiAqIElmIHNoYXBlZCBsaWtlIGEge0BsaW5rIHN1Ym1lbnVJdGVtfSBvYmplY3QgKG9yIGl0cyBhbHRlcm5hdGUgYXJyYXkgZm9ybSksIHNwZWNpZmllcyBhbiBgPG9wdGdyb3VwPi4uLi48L29wdGdyb3VwPmAgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IEJ1aWxkcyBhIG5ldyBtZW51IHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyBhbmQgZ3JvdXBzLlxuICogQGRlc2MgVGhpcyBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IHBvcC11cCBtZW51IChhLmsuYS4gXCJkcm9wLWRvd25cIikuIFRoaXMgaXMgYSBgPHNlbGVjdD4uLi48L3NlbGVjdD5gIGVsZW1lbnQsIHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyAoYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50cykgYW5kIGdyb3VwcyAoYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMpLlxuICogPiBCb251czogVGhpcyBmdW5jdGlvbiBhbHNvIGJ1aWxkcyBgaW5wdXQgdHlwZT10ZXh0YCBlbGVtZW50cy5cbiAqID4gTk9URTogVGhpcyBmdW5jdGlvbiBnZW5lcmF0ZXMgT1BUR1JPVVAgZWxlbWVudHMgZm9yIHN1YnRyZWVzLiBIb3dldmVyLCBub3RlIHRoYXQgSFRNTDUgc3BlY2lmaWVzIHRoYXQgT1BUR1JPVVAgZWxlbW5lbnRzIG1hZGUgbm90IG5lc3QhIFRoaXMgZnVuY3Rpb24gZ2VuZXJhdGVzIHRoZSBtYXJrdXAgZm9yIHRoZW0gYnV0IHRoZXkgYXJlIG5vdCByZW5kZXJlZCBieSBtb3N0IGJyb3dzZXJzLCBvciBub3QgY29tcGxldGVseS4gVGhlcmVmb3JlLCBmb3Igbm93LCBkbyBub3Qgc3BlY2lmeSBtb3JlIHRoYW4gb25lIGxldmVsIHN1YnRyZWVzLiBGdXR1cmUgdmVyc2lvbnMgb2YgSFRNTCBtYXkgc3VwcG9ydCBpdC4gSSBhbHNvIHBsYW4gdG8gYWRkIGhlcmUgb3B0aW9ucyB0byBhdm9pZCBPUFRHUk9VUFMgZW50aXJlbHkgZWl0aGVyIGJ5IGluZGVudGluZyBvcHRpb24gdGV4dCwgb3IgYnkgY3JlYXRpbmcgYWx0ZXJuYXRlIERPTSBub2RlcyB1c2luZyBgPGxpPmAgaW5zdGVhZCBvZiBgPHNlbGVjdD5gLCBvciBib3RoLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR8c3RyaW5nfSBlbCAtIE11c3QgYmUgb25lIG9mIChjYXNlLXNlbnNpdGl2ZSk6XG4gKiAqIHRleHQgYm94IC0gYW4gYEhUTUxJbnB1dEVsZW1lbnRgIHRvIHVzZSBhbiBleGlzdGluZyBlbGVtZW50IG9yIGAnSU5QVVQnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIGRyb3AtZG93biAtIGFuIGBIVE1MU2VsZWN0RWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdTRUxFQ1QnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIHN1Ym1lbnUgLSBhbiBgSFRNTE9wdEdyb3VwRWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdPUFRHUk9VUCdgIHRvIGNyZWF0ZSBhIG5ldyBvbmUgKG1lYW50IGZvciBpbnRlcm5hbCB1c2Ugb25seSlcbiAqXG4gKiBAcGFyYW0ge21lbnVJdGVtW119IFttZW51XSAtIEhpZXJhcmNoaWNhbCBsaXN0IG9mIHN0cmluZ3MgdG8gYWRkIGFzIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgb3IgYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnRzLiBPbWl0dGluZyBjcmVhdGVzIGEgdGV4dCBib3guXG4gKlxuICogQHBhcmFtIHtudWxsfHN0cmluZ30gW29wdGlvbnMucHJvbXB0PScnXSAtIEFkZHMgYW4gaW5pdGlhbCBgPG9wdGlvbj4uLi48L29wdGlvbj5gIGVsZW1lbnQgdG8gdGhlIGRyb3AtZG93biB3aXRoIHRoaXMgdmFsdWUgaW4gcGFyZW50aGVzZXMgYXMgaXRzIGB0ZXh0YDsgYW5kIGVtcHR5IHN0cmluZyBhcyBpdHMgYHZhbHVlYC4gRGVmYXVsdCBpcyBlbXB0eSBzdHJpbmcsIHdoaWNoIGNyZWF0ZXMgYSBibGFuayBwcm9tcHQ7IGBudWxsYCBzdXBwcmVzc2VzIHByb21wdCBhbHRvZ2V0aGVyLlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc29ydF0gLSBXaGV0aGVyIHRvIGFscGhhIHNvcnQgb3Igbm90LiBJZiB0cnV0aHksIHNvcnRzIGVhY2ggb3B0Z3JvdXAgb24gaXRzIGBsYWJlbGA7IGFuZCBlYWNoIHNlbGVjdCBvcHRpb24gb24gaXRzIHRleHQgKGl0cyBgYWxpYXNgIGlmIGdpdmVuOyBvciBpdHMgYG5hbWVgIGlmIG5vdCkuXG4gKlxuICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuYmxhY2tsaXN0XSAtIE9wdGlvbmFsIGxpc3Qgb2YgbWVudSBpdGVtIG5hbWVzIHRvIGJlIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuYnJlYWRjcnVtYnNdIC0gTGlzdCBvZiBvcHRpb24gZ3JvdXAgc2VjdGlvbiBudW1iZXJzIChyb290IGlzIHNlY3Rpb24gMCkuIChGb3IgaW50ZXJuYWwgdXNlLilcbiAqXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFwcGVuZD1mYWxzZV0gLSBXaGVuIGBlbGAgaXMgYW4gZXhpc3RpbmcgYDxzZWxlY3Q+YCBFbGVtZW50LCBnaXZpbmcgdHJ1dGh5IHZhbHVlIGFkZHMgdGhlIG5ldyBjaGlsZHJlbiB3aXRob3V0IGZpcnN0IHJlbW92aW5nIGV4aXN0aW5nIGNoaWxkcmVuLlxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fSBFaXRoZXIgYSBgPHNlbGVjdD5gIG9yIGA8b3B0Z3JvdXA+YCBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBidWlsZChlbCwgbWVudSwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIHByb21wdCA9IG9wdGlvbnMucHJvbXB0LFxuICAgICAgICBibGFja2xpc3QgPSBvcHRpb25zLmJsYWNrbGlzdCxcbiAgICAgICAgc29ydCA9IG9wdGlvbnMuc29ydCxcbiAgICAgICAgYnJlYWRjcnVtYnMgPSBvcHRpb25zLmJyZWFkY3J1bWJzIHx8IFtdLFxuICAgICAgICBwYXRoID0gYnJlYWRjcnVtYnMubGVuZ3RoID8gYnJlYWRjcnVtYnMuam9pbignLicpICsgJy4nIDogJycsXG4gICAgICAgIHN1YnRyZWVOYW1lID0gcG9wTWVudS5zdWJ0cmVlLFxuICAgICAgICBncm91cEluZGV4ID0gMCxcbiAgICAgICAgdGFnTmFtZTtcblxuICAgIGlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgdGFnTmFtZSA9IGVsLnRhZ05hbWU7XG4gICAgICAgIGlmICghb3B0aW9ucy5hcHBlbmQpIHtcbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9ICcnOyAvLyByZW1vdmUgYWxsIDxvcHRpb24+IGFuZCA8b3B0Z3JvdXA+IGVsZW1lbnRzXG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0YWdOYW1lID0gZWw7XG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbiAgICB9XG5cbiAgICBpZiAobWVudSkge1xuICAgICAgICB2YXIgYWRkLCBuZXdPcHRpb247XG4gICAgICAgIGlmICh0YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgYWRkID0gZWwuYWRkO1xuICAgICAgICAgICAgaWYgKHByb21wdCkge1xuICAgICAgICAgICAgICAgIG5ld09wdGlvbiA9IG5ldyBPcHRpb24ocHJvbXB0LCAnJyk7XG4gICAgICAgICAgICAgICAgbmV3T3B0aW9uLmlubmVySFRNTCArPSAnJmhlbGxpcDsnO1xuICAgICAgICAgICAgICAgIGVsLmFkZChuZXdPcHRpb24pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9tcHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbC5hZGQobmV3IE9wdGlvbigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFkZCA9IGVsLmFwcGVuZENoaWxkO1xuICAgICAgICAgICAgZWwubGFiZWwgPSBwcm9tcHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkge1xuICAgICAgICAgICAgbWVudSA9IG1lbnUuc2xpY2UoKS5zb3J0KGl0ZW1Db21wYXJhdG9yKTsgLy8gc29ydGVkIGNsb25lXG4gICAgICAgIH1cblxuICAgICAgICBtZW51LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgLy8gaWYgaXRlbSBpcyBvZiBmb3JtIGEoYikgYW5kIHRoZXJlIGlzIGFuIGZ1bmN0aW9uIGEgaW4gb3B0aW9ucywgdGhlbiBpdGVtID0gb3B0aW9ucy5hKGIpXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kaXJlY3Rpb24gPSBpdGVtLm1hdGNoKFJFR0VYUF9JTkRJUkVDVElPTik7XG4gICAgICAgICAgICAgICAgaWYgKGluZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhID0gaW5kaXJlY3Rpb25bMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICBiID0gaW5kaXJlY3Rpb25bMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmID0gb3B0aW9uc1thXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0gZihiKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdidWlsZDogRXhwZWN0ZWQgb3B0aW9ucy4nICsgYSArICcgdG8gYmUgYSBmdW5jdGlvbi4nO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICBpZiAoc3VidHJlZSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXBPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBicmVhZGNydW1iczogYnJlYWRjcnVtYnMuY29uY2F0KCsrZ3JvdXBJbmRleCksXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogaXRlbS5sYWJlbCB8fCAnR3JvdXAgJyArIHBhdGggKyBncm91cEluZGV4LFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBzb3J0LFxuICAgICAgICAgICAgICAgICAgICBibGFja2xpc3Q6IGJsYWNrbGlzdFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB2YXIgb3B0Z3JvdXAgPSBidWlsZCgnT1BUR1JPVVAnLCBzdWJ0cmVlLCBncm91cE9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGdyb3VwLmNoaWxkRWxlbWVudENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKG9wdGdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIShibGFja2xpc3QgJiYgYmxhY2tsaXN0LmluZGV4T2YoaXRlbSkgPj0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkLmNhbGwoZWwsIG5ldyBPcHRpb24oaXRlbSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5oaWRkZW4pIHtcblxuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gaXRlbS5uYW1lIHx8IGl0ZW0uYWxpYXM7XG4gICAgICAgICAgICAgICAgaWYgKCEoYmxhY2tsaXN0ICYmIGJsYWNrbGlzdC5pbmRleE9mKG5hbWUpID49IDApKSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZC5jYWxsKGVsLCBuZXcgT3B0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5hbGlhcyB8fCBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lXG4gICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbC50eXBlID0gJ3RleHQnO1xuICAgIH1cblxuICAgIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gaXRlbUNvbXBhcmF0b3IoYSwgYikge1xuICAgIGEgPSBhLmFsaWFzIHx8IGEubmFtZSB8fCBhLmxhYmVsIHx8IGE7XG4gICAgYiA9IGIuYWxpYXMgfHwgYi5uYW1lIHx8IGIubGFiZWwgfHwgYjtcbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgUmVjdXJzaXZlbHkgc2VhcmNoZXMgdGhlIGNvbnRleHQgYXJyYXkgb2YgYG1lbnVJdGVtYHMgZm9yIGEgbmFtZWQgYGl0ZW1gLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqIEB0aGlzIEFycmF5XG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMua2V5cz1bcG9wTWVudS5kZWZhdWx0S2V5XV0gLSBQcm9wZXJ0aWVzIHRvIHNlYXJjaCBlYWNoIG1lbnVJdGVtIHdoZW4gaXQgaXMgYW4gb2JqZWN0LlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYXNlU2Vuc2l0aXZlPWZhbHNlXSAtIElnbm9yZSBjYXNlIHdoaWxlIHNlYXJjaGluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIFZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfG1lbnVJdGVtfSBUaGUgZm91bmQgaXRlbSBvciBgdW5kZWZpbmVkYCBpZiBub3QgZm91bmQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cChvcHRpb25zLCB2YWx1ZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHZhbHVlID0gb3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB2YXIgc2hhbGxvdywgZGVlcCwgaXRlbSwgcHJvcCxcbiAgICAgICAga2V5cyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlzIHx8IFtwb3BNZW51LmRlZmF1bHRLZXldLFxuICAgICAgICBjYXNlU2Vuc2l0aXZlID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhc2VTZW5zaXRpdmU7XG5cbiAgICB2YWx1ZSA9IHRvU3RyaW5nKHZhbHVlLCBjYXNlU2Vuc2l0aXZlKTtcblxuICAgIHNoYWxsb3cgPSB0aGlzLmZpbmQoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bcG9wTWVudS5zdWJ0cmVlXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmIChzdWJ0cmVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZGVlcCA9IGxvb2t1cC5jYWxsKHN1YnRyZWUsIG9wdGlvbnMsIHZhbHVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9TdHJpbmcoaXRlbSwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgcHJvcCA9IGl0ZW1ba2V5c1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKHByb3AgJiYgdG9TdHJpbmcocHJvcCwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaXRlbSA9IGRlZXAgfHwgc2hhbGxvdztcblxuICAgIHJldHVybiBpdGVtICYmIChpdGVtLm5hbWUgPyBpdGVtIDogeyBuYW1lOiBpdGVtIH0pO1xufVxuXG5mdW5jdGlvbiB0b1N0cmluZyhzLCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIGlmIChzKSB7XG4gICAgICAgIHJlc3VsdCArPSBzOyAvLyBjb252ZXJ0IHMgdG8gc3RyaW5nXG4gICAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBSZWN1cnNpdmVseSB3YWxrcyB0aGUgY29udGV4dCBhcnJheSBvZiBgbWVudUl0ZW1gcyBhbmQgY2FsbHMgYGl0ZXJhdGVlYCBvbiBlYWNoIGl0ZW0gdGhlcmVpbi5cbiAqIEBkZXNjIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGggZWFjaCBpdGVtICh0ZXJtaW5hbCBub2RlKSBpbiB0aGUgbWVudSB0cmVlIGFuZCBhIGZsYXQgMC1iYXNlZCBpbmRleC4gUmVjdXJzZXMgb24gbWVtYmVyIHdpdGggbmFtZSBvZiBgcG9wTWVudS5zdWJ0cmVlYC5cbiAqXG4gKiBUaGUgbm9kZSB3aWxsIGFsd2F5cyBiZSBhIHtAbGluayB2YWx1ZUl0ZW19IG9iamVjdDsgd2hlbiBhIGBzdHJpbmdgLCBpdCBpcyBib3hlZCBmb3IgeW91LlxuICpcbiAqIEBtZW1iZXJPZiBwb3BNZW51XG4gKlxuICogQHRoaXMgQXJyYXlcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBpdGVyYXRlZSAtIEZvciBlYWNoIGl0ZW0gaW4gdGhlIG1lbnUsIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGg6XG4gKiAqIHRoZSBgdmFsdWVJdGVtYCAoaWYgdGhlIGl0ZW0gaXMgYSBwcmltYXRpdmUgc3RyaW5nLCBpdCBpcyB3cmFwcGVkIHVwIGZvciB5b3UpXG4gKiAqIGEgMC1iYXNlZCBgb3JkaW5hbGBcbiAqXG4gKiBUaGUgYGl0ZXJhdGVlYCByZXR1cm4gdmFsdWUgY2FuIGJlIHVzZWQgdG8gcmVwbGFjZSB0aGUgaXRlbSwgYXMgZm9sbG93czpcbiAqICogYHVuZGVmaW5lZGAgLSBkbyBub3RoaW5nXG4gKiAqIGBudWxsYCAtIHNwbGljZSBvdXQgdGhlIGl0ZW07IHJlc3VsdGluZyBlbXB0eSBzdWJtZW51cyBhcmUgYWxzbyBzcGxpY2VkIG91dCAoc2VlIG5vdGUpXG4gKiAqIGFueXRoaW5nIGVsc2UgLSByZXBsYWNlIHRoZSBpdGVtIHdpdGggdGhpcyB2YWx1ZTsgaWYgdmFsdWUgaXMgYSBzdWJ0cmVlIChpLmUuLCBhbiBhcnJheSkgYGl0ZXJhdGVlYCB3aWxsIHRoZW4gYmUgY2FsbGVkIHRvIHdhbGsgaXQgYXMgd2VsbCAoc2VlIG5vdGUpXG4gKlxuICogPiBOb3RlOiBSZXR1cm5pbmcgYW55dGhpbmcgKG90aGVyIHRoYW4gYHVuZGVmaW5lZGApIGZyb20gYGl0ZXJhdGVlYCB3aWxsIChkZWVwbHkpIG11dGF0ZSB0aGUgb3JpZ2luYWwgYG1lbnVgIHNvIHlvdSBtYXkgd2FudCB0byBjb3B5IGl0IGZpcnN0IChkZWVwbHksIGluY2x1ZGluZyBhbGwgbGV2ZWxzIG9mIGFycmF5IG5lc3RpbmcgYnV0IG5vdCB0aGUgdGVybWluYWwgbm9kZSBvYmplY3RzKS5cbiAqXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBOdW1iZXIgb2YgaXRlbXMgKHRlcm1pbmFsIG5vZGVzKSBpbiB0aGUgbWVudSB0cmVlLlxuICovXG5mdW5jdGlvbiB3YWxrKGl0ZXJhdGVlKSB7XG4gICAgdmFyIG1lbnUgPSB0aGlzLFxuICAgICAgICBvcmRpbmFsID0gMCxcbiAgICAgICAgc3VidHJlZU5hbWUgPSBwb3BNZW51LnN1YnRyZWUsXG4gICAgICAgIGksIGl0ZW0sIHN1YnRyZWUsIG5ld1ZhbDtcblxuICAgIGZvciAoaSA9IG1lbnUubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgaXRlbSA9IG1lbnVbaV07XG4gICAgICAgIHN1YnRyZWUgPSBpdGVtW3N1YnRyZWVOYW1lXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXN1YnRyZWUpIHtcbiAgICAgICAgICAgIG5ld1ZhbCA9IGl0ZXJhdGVlKGl0ZW0ubmFtZSA/IGl0ZW0gOiB7IG5hbWU6IGl0ZW0gfSwgb3JkaW5hbCk7XG4gICAgICAgICAgICBvcmRpbmFsICs9IDE7XG5cbiAgICAgICAgICAgIGlmIChuZXdWYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIG9yZGluYWwgLT0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW51W2ldID0gaXRlbSA9IG5ld1ZhbDtcbiAgICAgICAgICAgICAgICAgICAgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VidHJlZSkge1xuICAgICAgICAgICAgb3JkaW5hbCArPSB3YWxrLmNhbGwoc3VidHJlZSwgaXRlcmF0ZWUpO1xuICAgICAgICAgICAgaWYgKHN1YnRyZWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgb3JkaW5hbCAtPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yZGluYWw7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgRm9ybWF0IGl0ZW0gbmFtZSB3aXRoIGl0J3MgYWxpYXMgd2hlbiBhdmFpbGFibGUuXG4gKiBAbWVtYmVyT2YgcG9wTWVudVxuICogQHBhcmFtIHtzdHJpbmd8dmFsdWVJdGVtfSBpdGVtXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIG5hbWUgYW5kIGFsaWFzLlxuICovXG5mdW5jdGlvbiBmb3JtYXRJdGVtKGl0ZW0pIHtcbiAgICB2YXIgcmVzdWx0ID0gaXRlbS5uYW1lIHx8IGl0ZW07XG4gICAgaWYgKGl0ZW0uYWxpYXMpIHtcbiAgICAgICAgcmVzdWx0ID0gJ1wiJyArIGl0ZW0uYWxpYXMgKyAnXCIgKCcgKyByZXN1bHQgKyAnKSc7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuZnVuY3Rpb24gaXNHcm91cFByb3h5KHMpIHtcbiAgICByZXR1cm4gUkVHRVhQX0lORElSRUNUSU9OLnRlc3Qocyk7XG59XG5cbi8qKlxuICogQG5hbWVzcGFjZVxuICovXG52YXIgcG9wTWVudSA9IHtcbiAgICBidWlsZDogYnVpbGQsXG4gICAgd2Fsazogd2FsayxcbiAgICBsb29rdXA6IGxvb2t1cCxcbiAgICBmb3JtYXRJdGVtOiBmb3JtYXRJdGVtLFxuICAgIGlzR3JvdXBQcm94eTogaXNHcm91cFByb3h5LFxuICAgIHN1YnRyZWU6ICdzdWJtZW51JyxcbiAgICBkZWZhdWx0S2V5OiAnbmFtZSdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcG9wTWVudTtcbiIsIi8vIHRhYnogbm9kZSBtb2R1bGVcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9qb25laXQvdGFielxuXG4vKiBlc2xpbnQtZW52IG5vZGUsIGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3NzSW5qZWN0b3IgPSByZXF1aXJlKCdjc3MtaW5qZWN0b3InKTtcblxuLyoqXG4gKiBSZWdpc3Rlci9kZXJlZ2lzdGVyIGNsaWNrIGhhbmRsZXIgb24gYWxsIHRhYiBjb2xsZWN0aW9ucy5cbiAqIEBwYXJhbSB7RWxlbWVudH0gW29wdGlvbnMucm9vdD1kb2N1bWVudF0gLSBXaGVyZSB0byBsb29rIGZvciB0YWIgcGFuZWxzIChgLnRhYnpgIGVsZW1lbnRzKSBjb250YWluaW5nIHRhYnMgYW5kIGZvbGRlcnMuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVuaG9vaz1mYWxzZV0gLSBSZW1vdmUgZXZlbnQgbGlzdGVuZXIgZnJvbSB0YWIgcGFuZWxzIChgLnRhYnpgIGVsZW1lbnRzKS5cbiAqIEBwYXJhbSB7RWxlbWVudH0gW29wdGlvbnMucmVmZXJlbmNlRWxlbWVudF0gLSBQYXNzZWQgdG8gY3NzSW5qZWN0b3IncyBpbnNlcnRCZWZvcmUoKSBjYWxsLlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlZmF1bHRUYWJTZWxlY3Rvcj0nLmRlZmF1bHQtdGFiJ10gLSAuY2xhc3NuYW1lIG9yICNpZCBvZiB0aGUgdGFiIHRvIHNlbGVjdCBieSBkZWZhdWx0XG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMub25FbmFibGVdIC0gSGFuZGxlciBpbXBsZW1lbnRhdGlvbi4gU2VlIHtAbGluayBUYWJ6I29uRW5hYmxlfG9uRW5hYmxlfS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5vbkRpc2FibGVdIC0gSGFuZGxlciBpbXBsZW1lbnRhdGlvbi4gU2VlIHtAbGluayBUYWJ6I29uRGlzYWJsZXxvbkVuYWJsZX0uXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMub25FbmFibGVkXSAtIEhhbmRsZXIgaW1wbGVtZW50YXRpb24uIFNlZSB7QGxpbmsgVGFieiNvbkVuYWJsZWR8b25FbmFibGV9LlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLm9uRGlzYWJsZWRdIC0gSGFuZGxlciBpbXBsZW1lbnRhdGlvbi4gU2VlIHtAbGluayBUYWJ6I29uRGlzYWJsZWR8b25FbmFibGV9LlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIFRhYnoob3B0aW9ucykge1xuICAgIHZhciBpLCBlbDtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciByb290ID0gb3B0aW9ucy5yb290IHx8IGRvY3VtZW50LFxuICAgICAgICB1bmhvb2sgPSBvcHRpb25zLnVuaG9vayxcbiAgICAgICAgcmVmZXJlbmNlRWxlbWVudCA9IG9wdGlvbnMucmVmZXJlbmNlRWxlbWVudCxcbiAgICAgICAgZGVmYXVsdFRhYlNlbGVjdG9yID0gb3B0aW9ucy5kZWZhdWx0VGFiU2VsZWN0b3IgfHwgJy5kZWZhdWx0LXRhYic7XG5cbiAgICBpZiAoIXVuaG9vaykge1xuICAgICAgICB2YXIgY3NzO1xuICAgICAgICAvKiBpbmplY3Q6Y3NzICovXG4gICAgICAgIGNzcyA9ICcudGFientwb3NpdGlvbjpyZWxhdGl2ZTt2aXNpYmlsaXR5OmhpZGRlbjtoZWlnaHQ6MTAwJX0udGFiej5oZWFkZXJ7cG9zaXRpb246cmVsYXRpdmU7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZC1jb2xvcjojZmZmO21hcmdpbi1sZWZ0OjFlbTtwYWRkaW5nOjVweCAuNmVtO2JvcmRlcjoxcHggc29saWQgIzY2Njtib3JkZXItYm90dG9tLWNvbG9yOnRyYW5zcGFyZW50O2JvcmRlci1yYWRpdXM6NnB4IDZweCAwIDA7Y3Vyc29yOmRlZmF1bHQ7dXNlci1zZWxlY3Q6bm9uZTstd2Via2l0LXVzZXItc2VsZWN0Om5vbmU7LW1vei11c2VyLXNlbGVjdDpub25lOy1tcy11c2VyLXNlbGVjdDpub25lfS50YWJ6PmhlYWRlcitzZWN0aW9ue3Bvc2l0aW9uOmFic29sdXRlO2Rpc3BsYXk6bm9uZTtiYWNrZ3JvdW5kLWNvbG9yOiNmZmY7bWFyZ2luLXRvcDotMXB4O3BhZGRpbmc6OHB4O2JvcmRlcjoxcHggc29saWQgIzY2Njtib3JkZXItcmFkaXVzOjZweDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206MDt0b3A6MDt6LWluZGV4OjB9LnRhYno+aGVhZGVyK3NlY3Rpb24udGFiei1lbmFibGV7ei1pbmRleDoxfS50YWJ6PmhlYWRlci50YWJ6LWVuYWJsZXt6LWluZGV4OjJ9LnRhYnotYmcwe2JhY2tncm91bmQtY29sb3I6I2VlZSFpbXBvcnRhbnR9LnRhYnotYmcxe2JhY2tncm91bmQtY29sb3I6I2VlZiFpbXBvcnRhbnR9LnRhYnotYmcye2JhY2tncm91bmQtY29sb3I6I2VmZSFpbXBvcnRhbnR9LnRhYnotYmcze2JhY2tncm91bmQtY29sb3I6I2VmZiFpbXBvcnRhbnR9LnRhYnotYmc0e2JhY2tncm91bmQtY29sb3I6I2ZlZSFpbXBvcnRhbnR9LnRhYnotYmc1e2JhY2tncm91bmQtY29sb3I6I2ZlZiFpbXBvcnRhbnR9LnRhYnotYmc2e2JhY2tncm91bmQtY29sb3I6I2ZmZSFpbXBvcnRhbnR9JztcbiAgICAgICAgLyogZW5kaW5qZWN0ICovXG5cbiAgICAgICAgaWYgKCFyZWZlcmVuY2VFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBmaW5kIGZpcnN0IDxsaW5rPiBvciA8c3R5bGU+IGluIDxoZWFkPlxuICAgICAgICAgICAgdmFyIGhlYWRTdHVmZiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2hlYWQnKS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7ICFyZWZlcmVuY2VFbGVtZW50ICYmIGkgPCBoZWFkU3R1ZmYubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBlbCA9IGhlYWRTdHVmZltpXTtcbiAgICAgICAgICAgICAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ1NUWUxFJyB8fCBlbC50YWdOYW1lID09PSAnTElOSycgJiYgZWwucmVsID09PSAnc3R5bGVzaGVldCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlRWxlbWVudCA9IGVsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjc3NJbmplY3Rvcihjc3MsICd0YWJ6LWNzcy1iYXNlJywgcmVmZXJlbmNlRWxlbWVudCk7XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzW2tleV0gPT09IG5vb3ApIHtcbiAgICAgICAgICAgICAgICB0aGlzW2tleV0gPSBvcHRpb25zW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQHN1bW1hcnkgVGhlIGNvbnRleHQgb2YgdGhpcyB0YWIgb2JqZWN0LlxuICAgICAgICAgKiBAZGVzYyBUaGUgY29udGV4dCBtYXkgZW5jb21wYXNzIGFueSBudW1iZXIgb2YgdGFiIHBhbmVscyAoYC50YWJ6YCBlbGVtZW50cykuXG4gICAgICAgICAqIEB0eXBlIHtIVE1MRG9jdW1lbnxIVE1MRWxlbWVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3Q7XG5cbiAgICAgICAgLy8gZW5hYmxlIGZpcnN0IHRhYiBvbiBlYWNoIHRhYiBwYW5lbCAoYC50YWJ6YCBlbGVtZW50KVxuICAgICAgICBmb3JFYWNoRWwoJy50YWJ6PmhlYWRlcjpmaXJzdC1vZi10eXBlLC50YWJ6PnNlY3Rpb246Zmlyc3Qtb2YtdHlwZScsIGZ1bmN0aW9uKGVsKSB7XG4gICAgICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKCd0YWJ6LWVuYWJsZScpO1xuICAgICAgICB9LCByb290KTtcblxuICAgICAgICAvLyBlbmFibGUgZGVmYXVsdCB0YWIgYW5kIGFsbCBpdHMgcGFyZW50cyAobXVzdCBiZSBhIHRhYilcbiAgICAgICAgdGhpcy50YWJUbyhyb290LnF1ZXJ5U2VsZWN0b3IoJy50YWJ6ID4gaGVhZGVyJyArIGRlZmF1bHRUYWJTZWxlY3RvcikpO1xuXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBmb3JFYWNoRWwoJy50YWJ6ID4gc2VjdGlvbicsIGZ1bmN0aW9uKGVsKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBTdGVwIDE6IEEgYnVnIGluIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSAobGlrZSB2NDApIHRoYXQgaW5zZXJ0ZWQgYSBicmVhayBhdCBtYXJrLXVwIGxvY2F0aW9uIG9mIGFuIGFic29sdXRlIHBvc2l0aW9uZWQgYmxvY2suIFRoZSB3b3JrLWFyb3VuZCBpcyB0byBoaWRlIHRob3NlIGJsb2NrcyB1bnRpbCBhZnRlciBmaXJzdCByZW5kZXI7IHRoZW4gc2hvdyB0aGVtLiBJIGRvbid0IGtub3cgd2h5IHRoaXMgd29ya3MgYnV0IGl0IGRvZXMuIFNlZW1zIHRvIGJlIGR1cmFibGUuXG4gICAgICAgICAgICAgICAgZWwuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cbiAgICAgICAgICAgICAgICAvLyBTdGVwIDI6IEFkanVzdCBhYnNvbHV0ZSB0b3Agb2YgZWFjaCByZW5kZXJlZCBmb2xkZXIgdG8gdGhlIGJvdHRvbSBvZiBpdHMgdGFiXG4gICAgICAgICAgICAgICAgZWwuc3R5bGUudG9wID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5ib3R0b20gLSBlbC5wYXJlbnRFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCArICdweCc7XG5cbiAgICAgICAgICAgIH0sIHJvb3QpO1xuICAgICAgICB9LCAwKTtcbiAgICB9XG5cbiAgICB2YXIgbWV0aG9kID0gdW5ob29rID8gJ3JlbW92ZUV2ZW50TGlzdGVuZXInIDogJ2FkZEV2ZW50TGlzdGVuZXInO1xuICAgIHZhciBib3VuZENsaWNrSGFuZGxlciA9IG9uY2xpY2suYmluZCh0aGlzKTtcbiAgICBmb3JFYWNoRWwoJy50YWJ6JywgZnVuY3Rpb24odGFiQmFyKSB7XG4gICAgICAgIHRhYkJhci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICB0YWJCYXJbbWV0aG9kXSgnY2xpY2snLCBib3VuZENsaWNrSGFuZGxlcik7XG4gICAgfSwgcm9vdCk7XG59XG5cbmZ1bmN0aW9uIG9uY2xpY2soZXZ0KSB7XG4gICAgY2xpY2suY2FsbCh0aGlzLCBldnQuY3VycmVudFRhcmdldCwgZXZ0LnRhcmdldCk7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgU2VsZWN0cyB0aGUgZ2l2ZW4gdGFiLlxuICogQGRlc2MgSWYgaXQgaXMgYSBuZXN0ZWQgdGFiLCBhbHNvIHJldmVhbHMgYWxsIGl0cyBhbmNlc3RvciB0YWJzLlxuICogQHBhcmFtIHtzdHJpbmd8SFRNTEVsZW1lbnR9IFtlbF0gLSBNYXkgYmUgb25lIG9mOlxuICogKiBgSFRNTEVsZW1lbnRgXG4gKiAgICogYDxoZWFkZXI+YCAtIHRhYiBlbGVtZW50XG4gKiAgICogYDxzZWN0aW9uPmAgLSBmb2xkZXIgZWxlbWVudFxuICogKiBgc3RyaW5nYCAtIENTUyBzZWxlY3RvciB0byBvbmUgb2YgdGhlIGFib3ZlXG4gKiAqIGZhbHN5IC0gZmFpbHMgc2lsZW50bHlcbiAqIEBtZW1iZXJPZiBUYWJ6LnByb3RvdHlwZVxuICovXG5UYWJ6LnByb3RvdHlwZS50YWJUbyA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgd2hpbGUgKChlbCA9IHRoaXMudGFiKGVsKSkpIHtcbiAgICAgICAgY2xpY2suY2FsbCh0aGlzLCBlbC5wYXJlbnRFbGVtZW50LCBlbCk7XG4gICAgICAgIGVsID0gZWwucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50OyAvLyBsb29wIHRvIGNsaWNrIG9uIGVhY2ggY29udGFpbmluZyB0YWIuLi5cbiAgICB9XG59O1xuXG4vKipcbiAqIEN1cnJlbnQgc2VsZWN0ZWQgdGFiLlxuICogQHBhcmFtIHtIVE1MRWxlbWVudHxudW1iZXJ9IGVsIC0gQW4gZWxlbWVudCB0aGF0IGlzIChvciBpcyB3aXRoaW4pIHRoZSB0YWIgcGFuZWwgKGAudGFiemAgZWxlbWVudCkgdG8gbG9vayBpbi5cbiAqIEByZXR1cm5zIHt1bmRlZmluZWR8SFRNTEVsZW1lbnR9IFJldHVybnMgdGFiIChgPGhlYWRlcj5gKSBlbGVtZW50LiAgUmV0dXJucyBgdW5kZWZpbmVkYCBpZiBgZWxgIGlzIG5laXRoZXIgb2YgdGhlIGFib3ZlIG9yIGFuIG91dCBvZiByYW5nZSBpbmRleC5cbiAqL1xuVGFiei5wcm90b3R5cGUuZW5hYmxlZFRhYiA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgZWwgPSB0aGlzLnBhbmVsKGVsKTtcbiAgICByZXR1cm4gZWwgJiYgZWwucXVlcnlTZWxlY3RvcignOnNjb3BlPmhlYWRlci50YWJ6LWVuYWJsZScpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBHZXQgdGFiIGVsZW1lbnQuXG4gKiBAZGVzYyBHZXQgdGFiIGVsZW1lbnQgaWYgZ2l2ZW4gdGFiIG9yIGZvbGRlciBlbGVtZW50OyBvciBhbiBlbGVtZW50IHdpdGhpbiBzdWNoOyBvciBmaW5kIHRhYi5cbiAqIEBwYXJhbSB7c3RyaW5nfEVsZW1lbnR9IFtlbF0gLSBNYXkgYmUgb25lIG9mOlxuICogKiBhIHRhYiAoYSBgPGhlYWRlcj5gIGVsZW1lbnQpXG4gKiAqIGEgZm9sZGVyIChhIGA8c2VjdGlvbj5gIGVsZW1lbnQpXG4gKiAqIGFuIGVsZW1lbnQgd2l0aGluIG9uZSBvZiB0aGUgYWJvdmVcbiAqICogYHN0cmluZ2AgLSBDU1Mgc2VsZWN0b3IgdG8gb25lIG9mIHRoZSBhYm92ZSwgc2VhcmNoaW5nIHdpdGhpbiB0aGUgcm9vdCBvciBkb2N1bWVudFxuICogQHJldHVybnMge251bGx8RWxlbWVudH0gdGFiIChgPGhlYWRlcj4uLi48L2hlYWRlcj5gKSBlbGVtZW50IG9yIGBudWxsYCBpZiBub3QgZm91bmRcbiAqIEBtZW1iZXJPZiBUYWJ6LnByb3RvdHlwZVxuICovXG5UYWJ6LnByb3RvdHlwZS50YWIgPSBmdW5jdGlvbihlbCkge1xuICAgIGVsID0gbG9va0ZvckVsLmNhbGwodGhpcywgZWwpO1xuICAgIHJldHVybiAhKGVsIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpID8gbnVsbCA6IGVsLnRhZ05hbWUgPT09ICdIRUFERVInID8gZWwgOiBlbC50YWdOYW1lID09PSAnU0VDVElPTicgPyBlbC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nIDogbnVsbDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IGZvbGRlciBlbGVtZW50LlxuICogQGRlc2MgR2V0IGZvbGRlciBlbGVtZW50IGlmIGdpdmVuIHRhYiBvciBmb2xkZXIgZWxlbWVudDsgb3IgYW4gZWxlbWVudCB3aXRoaW4gc3VjaDsgb3IgZmluZCBmb2xkZXIuXG4gKiBAcGFyYW0ge3N0cmluZ3xFbGVtZW50fSBbZWxdIC0gTWF5IGJlIG9uZSBvZjpcbiAqICogYSB0YWIgKGEgYDxoZWFkZXI+YCBlbGVtZW50KVxuICogKiBhIGZvbGRlciAoYSBgPHNlY3Rpb24+YCBlbGVtZW50KVxuICogKiBhbiBlbGVtZW50IHdpdGhpbiBvbmUgb2YgdGhlIGFib3ZlXG4gKiAqIGBzdHJpbmdgIC0gQ1NTIHNlbGVjdG9yIHRvIG9uZSBvZiB0aGUgYWJvdmUsIHNlYXJjaGluZyB3aXRoaW4gdGhlIHJvb3Qgb3IgZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtudWxsfEVsZW1lbnR9IHRhYiAoYDxoZWFkZXI+Li4uPC9oZWFkZXI+YCkgZWxlbWVudCBvciBgbnVsbGAgaWYgbm90IGZvdW5kXG4gKiBAbWVtYmVyT2YgVGFiei5wcm90b3R5cGVcbiAqL1xuVGFiei5wcm90b3R5cGUuZm9sZGVyID0gZnVuY3Rpb24oZWwpIHtcbiAgICBlbCA9IGxvb2tGb3JFbC5jYWxsKHRoaXMsIGVsKTtcbiAgICByZXR1cm4gIShlbCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSA/IG51bGwgOiBlbC50YWdOYW1lID09PSAnU0VDVElPTicgPyBlbCA6IGVsLnRhZ05hbWUgPT09ICdIRUFERVInID8gZWwubmV4dEVsZW1lbnRTaWJsaW5nIDogbnVsbDtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRhYiBwYW5lbCBlbGVtZW50LlxuICogQGRlc2MgR2V0IHBhbmVsIGVsZW1lbnQgaWYgZ2l2ZW4gdGFiIHBhbmVsIGVsZW1lbnQ7IG9yIGFuIGVsZW1lbnQgd2l0aGluIGEgdGFiIHBhbmVsOyBvciBmaW5kIHRhYiBwYW5lbC5cbiAqIEBwYXJhbSB7c3RyaW5nfEVsZW1lbnR9IFtlbF0gLSBNYXkgYmUgb25lIG9mOlxuICogKiBhIHRhYiBwYW5lbCAoYW4gYEhUTUxFbGVtZW50YCB3aXRoIGNsYXNzIGB0YWJ6YClcbiAqICogYW4gZWxlbWVudCB3aXRoaW4gYSB0YWIgcGFuZWxcbiAqICogYHN0cmluZ2AgLSBDU1Mgc2VsZWN0b3IgdG8gb25lIGEgdGFiIHBhbmVsLCBzZWFyY2hpbmcgd2l0aGluIHRoZSByb290IG9yIGRvY3VtZW50XG4gKiBAcmV0dXJucyB7bnVsbHxFbGVtZW50fSB0YWIgcGFuZWwgZWxlbWVudCBvciBgbnVsbGAgaWYgbm90IGZvdW5kXG4gKiBAbWVtYmVyT2YgVGFiei5wcm90b3R5cGVcbiAqL1xuVGFiei5wcm90b3R5cGUucGFuZWwgPSBmdW5jdGlvbihlbCkge1xuICAgIHdoaWxlIChlbCAmJiAhZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCd0YWJ6JykpIHtcbiAgICAgICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgICByZXR1cm4gIShlbCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSA/IG51bGwgOiBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ3RhYnonKSA/IGVsIDogbnVsbDtcbn07XG5cbmZ1bmN0aW9uIGxvb2tGb3JFbChlbCkge1xuICAgIGlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgd2hpbGUgKGVsICYmIGVsLnRhZ05hbWUgIT09ICdIRUFERVInICYmIGVsLnRhZ05hbWUgIT09ICdTRUNUSU9OJykge1xuICAgICAgICAgICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZWwgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihlbCk7XG4gICAgfVxuICAgIHJldHVybiBlbDtcbn1cblxuLyoqIEVuYWJsZXMgdGhlIHRhYi9mb2xkZXIgcGFpciBvZiB0aGUgY2xpY2tlZCB0YWIuXG4gKiBEaXNhYmxlcyBhbGwgdGhlIG90aGVyIHBhaXJzIGluIHRoaXMgc2NvcGUgd2hpY2ggd2lsbCBpbmNsdWRlIHRoZSBwcmV2aW91c2x5IGVuYWJsZWQgcGFpci5cbiAqIEBwcml2YXRlXG4gKiBAdGhpcyBUYWJ6XG4gKiBAcGFyYW0ge0VsZW1lbnR9IGRpdiAtIFRoZSB0YWIgcGFuZWwgKGAudGFiemAgZWxlbWVudCkgdGhhdCdzIGhhbmRsaW5nIHRoZSBjbGljayBldmVudC5cbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0IC0gVGhlIGVsZW1lbnQgdGhhdCByZWNlaXZlZCB0aGUgY2xpY2suXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVsZW1lbnR9IFRoZSBgPGhlYWRlcj5gIGVsZW1lbnQgKHRhYikgdGhlIHdhcyBjbGlja2VkOyBvciBgdW5kZWZpbmVkYCB3aGVuIGNsaWNrIHdhcyBub3Qgd2l0aGluIGEgdGFiLlxuICovXG5mdW5jdGlvbiBjbGljayhkaXYsIHRhcmdldCkge1xuICAgIHZhciBuZXdUYWIsIG9sZFRhYjtcblxuICAgIGZvckVhY2hFbCgnOnNjb3BlPmhlYWRlcjpub3QoLnRhYnotZW5hYmxlKScsIGZ1bmN0aW9uKHRhYikgeyAvLyB0b2RvOiB1c2UgYSAuZmluZCgpIHBvbHlmaWxsIGhlcmVcbiAgICAgICAgaWYgKHRhYi5jb250YWlucyh0YXJnZXQpKSB7XG4gICAgICAgICAgICBuZXdUYWIgPSB0YWI7XG4gICAgICAgIH1cbiAgICB9LCBkaXYpO1xuXG4gICAgaWYgKG5ld1RhYikge1xuICAgICAgICBvbGRUYWIgPSB0aGlzLmVuYWJsZWRUYWIoZGl2KTtcbiAgICAgICAgdG9nZ2xlVGFiLmNhbGwodGhpcywgb2xkVGFiLCBmYWxzZSk7XG4gICAgICAgIHRvZ2dsZVRhYi5jYWxsKHRoaXMsIG5ld1RhYiwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1RhYjtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICogQHRoaXMgVGFielxuICogQHBhcmFtIHtFbGVtZW50fSB0YWIgLSBUaGUgYDxoZWFkZXI+YCBlbGVtZW50IG9mIHRoZSB0YWIgdG8gZW5hYmxlIG9yIGRpc2FibGUuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAtIEVuYWJsZSAodnMuIGRpc2FibGUpIHRoZSB0YWIuXG4gKi9cbmZ1bmN0aW9uIHRvZ2dsZVRhYih0YWIsIGVuYWJsZSkge1xuICAgIGlmICh0YWIpIHtcbiAgICAgICAgdmFyIGZvbGRlciA9IHRoaXMuZm9sZGVyKHRhYiksXG4gICAgICAgICAgICBtZXRob2QgPSBlbmFibGUgPyAnb25FbmFibGUnIDogJ29uRGlzYWJsZSc7XG5cbiAgICAgICAgdGhpc1ttZXRob2RdLmNhbGwodGhpcywgdGFiLCBmb2xkZXIpO1xuXG4gICAgICAgIHRhYi5jbGFzc0xpc3QudG9nZ2xlKCd0YWJ6LWVuYWJsZScsIGVuYWJsZSk7XG4gICAgICAgIGZvbGRlci5jbGFzc0xpc3QudG9nZ2xlKCd0YWJ6LWVuYWJsZScsIGVuYWJsZSk7XG5cbiAgICAgICAgbWV0aG9kICs9ICdkJztcbiAgICAgICAgdGhpc1ttZXRob2RdLmNhbGwodGhpcywgdGFiLCBmb2xkZXIpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBAdHlwZWRlZiB0YWJFdmVudFxuICogQHR5cGUge2Z1bmN0aW9ufVxuICogQHBhcmFtIHt0YWJFdmVudE9iamVjdH1cbiAqL1xuXG4vKipcbiAqIEB0eXBlZGVmIHRhYkV2ZW50T2JqZWN0XG4gKiBAcHJvcGVydHkge1RhYnp9IHRhYnogLSBUaGUgdGFiIG9iamVjdCBpc3N1aW5nIHRoZSBjYWxsYmFjay5cbiAqIEBwcm9wZXJ0eSB7RWxlbWVudH0gdGFyZ2V0IC0gVGhlIHRhYiAoYDxoZWFkZXI+YCBlbGVtZW50KS5cbiAqL1xuXG4vKipcbiAqIENhbGxlZCBiZWZvcmUgYSBwcmV2aW91c2x5IGRpc2FibGVkIHRhYiBpcyBlbmFibGVkLlxuICogQHR5cGUge3RhYkV2ZW50fVxuICogQGFic3RyYWN0XG4gKiBAbWVtYmVyT2YgVGFiei5wcm90b3R5cGVcbiAqL1xuVGFiei5wcm90b3R5cGUub25FbmFibGUgPSBub29wO1xuXG4vKipcbiAqIENhbGxlZCBiZWZvcmUgYSBwcmV2aW91c2x5IGVuYWJsZWQgdGFiIGlzIGRpc2FibGVkIGJ5IGFub3RoZXIgdGFiIGJlaW5nIGVuYWJsZWQuXG4gKiBAdHlwZSB7dGFiRXZlbnR9XG4gKiBAYWJzdHJhY3RcbiAqIEBtZW1iZXJPZiBUYWJ6LnByb3RvdHlwZVxuICovXG5UYWJ6LnByb3RvdHlwZS5vbkRpc2FibGUgPSBub29wO1xuXG4vKipcbiAqIENhbGxlZCBhZnRlciBhIHByZXZpb3VzbHkgZGlzYWJsZWQgdGFiIGlzIGVuYWJsZWQuXG4gKiBAdHlwZSB7dGFiRXZlbnR9XG4gKiBAYWJzdHJhY3RcbiAqIEBtZW1iZXJPZiBUYWJ6LnByb3RvdHlwZVxuICovXG5UYWJ6LnByb3RvdHlwZS5vbkVuYWJsZWQgPSBub29wO1xuXG4vKipcbiAqIENhbGxlZCBhZnRlciBhIHByZXZpb3VzbHkgZW5hYmxlZCB0YWIgaXMgZGlzYWJsZWQgYnkgYW5vdGhlciB0YWIgYmVpbmcgZW5hYmxlZC5cbiAqIEB0eXBlIHt0YWJFdmVudH1cbiAqIEBhYnN0cmFjdFxuICogQG1lbWJlck9mIFRhYnoucHJvdG90eXBlXG4gKi9cblRhYnoucHJvdG90eXBlLm9uRGlzYWJsZWQgPSBub29wO1xuXG5mdW5jdGlvbiBub29wKCkge30gLy8gbnVsbCBwYXR0ZXJuXG5cbmZ1bmN0aW9uIGZvckVhY2hFbChzZWxlY3RvciwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCgoY29udGV4dCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvciksIGl0ZXJhdGVlKTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFRhYno7XG4iLCIvLyB0ZW1wbGV4IG5vZGUgbW9kdWxlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L3RlbXBsZXhcblxuLyogZXNsaW50LWVudiBub2RlICovXG5cbi8qKlxuICogTWVyZ2VzIHZhbHVlcyBvZiBleGVjdXRpb24gY29udGV4dCBwcm9wZXJ0aWVzIG5hbWVkIGluIHRlbXBsYXRlIGJ5IHtwcm9wMX0sXG4gKiB7cHJvcDJ9LCBldGMuLCBvciBhbnkgamF2YXNjcmlwdCBleHByZXNzaW9uIGluY29ycG9yYXRpbmcgc3VjaCBwcm9wIG5hbWVzLlxuICogVGhlIGNvbnRleHQgYWx3YXlzIGluY2x1ZGVzIHRoZSBnbG9iYWwgb2JqZWN0LiBJbiBhZGRpdGlvbiB5b3UgY2FuIHNwZWNpZnkgYSBzaW5nbGVcbiAqIGNvbnRleHQgb3IgYW4gYXJyYXkgb2YgY29udGV4dHMgdG8gc2VhcmNoIChpbiB0aGUgb3JkZXIgZ2l2ZW4pIGJlZm9yZSBmaW5hbGx5XG4gKiBzZWFyY2hpbmcgdGhlIGdsb2JhbCBjb250ZXh0LlxuICpcbiAqIE1lcmdlIGV4cHJlc3Npb25zIGNvbnNpc3Rpbmcgb2Ygc2ltcGxlIG51bWVyaWMgdGVybXMsIHN1Y2ggYXMgezB9LCB7MX0sIGV0Yy4sIGRlcmVmXG4gKiB0aGUgZmlyc3QgY29udGV4dCBnaXZlbiwgd2hpY2ggaXMgYXNzdW1lZCB0byBiZSBhbiBhcnJheS4gQXMgYSBjb252ZW5pZW5jZSBmZWF0dXJlLFxuICogaWYgYWRkaXRpb25hbCBhcmdzIGFyZSBnaXZlbiBhZnRlciBgdGVtcGxhdGVgLCBgYXJndW1lbnRzYCBpcyB1bnNoaWZ0ZWQgb250byB0aGUgY29udGV4dFxuICogYXJyYXksIHRodXMgbWFraW5nIGZpcnN0IGFkZGl0aW9uYWwgYXJnIGF2YWlsYWJsZSBhcyB7MX0sIHNlY29uZCBhcyB7Mn0sIGV0Yy4sIGFzIGluXG4gKiBgdGVtcGxleCgnSGVsbG8sIHsxfSEnLCAnV29ybGQnKWAuICh7MH0gaXMgdGhlIHRlbXBsYXRlIHNvIGNvbnNpZGVyIHRoaXMgdG8gYmUgMS1iYXNlZC4pXG4gKlxuICogSWYgeW91IHByZWZlciBzb21ldGhpbmcgb3RoZXIgdGhhbiBicmFjZXMsIHJlZGVmaW5lIGB0ZW1wbGV4LnJlZ2V4cGAuXG4gKlxuICogU2VlIHRlc3RzIGZvciBleGFtcGxlcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqIEBwYXJhbSB7Li4uc3RyaW5nfSBbYXJnc11cbiAqL1xuZnVuY3Rpb24gdGVtcGxleCh0ZW1wbGF0ZSkge1xuICAgIHZhciBjb250ZXh0cyA9IHRoaXMgaW5zdGFuY2VvZiBBcnJheSA/IHRoaXMgOiBbdGhpc107XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7IGNvbnRleHRzLnVuc2hpZnQoYXJndW1lbnRzKTsgfVxuICAgIHJldHVybiB0ZW1wbGF0ZS5yZXBsYWNlKHRlbXBsZXgucmVnZXhwLCB0ZW1wbGV4Lm1lcmdlci5iaW5kKGNvbnRleHRzKSk7XG59XG5cbnRlbXBsZXgucmVnZXhwID0gL1xceyguKj8pXFx9L2c7XG5cbnRlbXBsZXgud2l0aCA9IGZ1bmN0aW9uIChpLCBzKSB7XG4gICAgcmV0dXJuICd3aXRoKHRoaXNbJyArIGkgKyAnXSl7JyArIHMgKyAnfSc7XG59O1xuXG50ZW1wbGV4LmNhY2hlID0gW107XG5cbnRlbXBsZXguZGVyZWYgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKCEodGhpcy5sZW5ndGggaW4gdGVtcGxleC5jYWNoZSkpIHtcbiAgICAgICAgdmFyIGNvZGUgPSAncmV0dXJuIGV2YWwoZXhwciknO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29kZSA9IHRlbXBsZXgud2l0aChpLCBjb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBsZXguY2FjaGVbdGhpcy5sZW5ndGhdID0gZXZhbCgnKGZ1bmN0aW9uKGV4cHIpeycgKyBjb2RlICsgJ30pJyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZXZhbFxuICAgIH1cbiAgICByZXR1cm4gdGVtcGxleC5jYWNoZVt0aGlzLmxlbmd0aF0uY2FsbCh0aGlzLCBrZXkpO1xufTtcblxudGVtcGxleC5tZXJnZXIgPSBmdW5jdGlvbiAobWF0Y2gsIGtleSkge1xuICAgIC8vIEFkdmFuY2VkIGZlYXR1cmVzOiBDb250ZXh0IGNhbiBiZSBhIGxpc3Qgb2YgY29udGV4dHMgd2hpY2ggYXJlIHNlYXJjaGVkIGluIG9yZGVyLlxuICAgIHZhciByZXBsYWNlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gaXNOYU4oa2V5KSA/IHRlbXBsZXguZGVyZWYuY2FsbCh0aGlzLCBrZXkpIDogdGhpc1swXVtrZXldO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVwbGFjZW1lbnQgPSAneycgKyBrZXkgKyAnfSc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcGxhY2VtZW50O1xufTtcblxuLy8gdGhpcyBpbnRlcmZhY2UgY29uc2lzdHMgc29sZWx5IG9mIHRoZSB0ZW1wbGV4IGZ1bmN0aW9uIChhbmQgaXQncyBwcm9wZXJ0aWVzKVxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGV4O1xuIl19
