(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var DefaultFilter = require('./js/DefaultFilter');
var ColumnSchemaFactory = require('./js/ColumnSchemaFactory');

/**
 * @param {Hypergrid} grid
 * @param {object} [targets] - Hash of mixin targets. These are typically prototype objects. If not given or any targets are missing, defaults to current grid's various prototypes.
 * @constructor
 */
function Hyperfilter(grid, targets) {
    this.grid = grid;
    targets = targets || {};

    mixInTo('Hypergrid', grid, require('./mix-ins/grid'));
    mixInTo('Behavior', grid.behavior, require('./mix-ins/behavior'));
    mixInTo('DataModel', grid.behavior.dataModel, require('./mix-ins/dataModel'));

    function mixInTo(target, instance, mixin) {
        var object = targets[target];
        var prototype = object && object.prototype || Object.getPrototypeOf(instance);

        prototype.mixIn(mixin);
    }
}

Hyperfilter.prototype = {
    constructor: Hyperfilter.prototype.constructor,

    $$CLASS_NAME: 'Hyperfilter',

    /**
     * @type {boolean}
     */
    caseSensitiveData: true,

    /**
     * @type {boolean}
     */
    caseSensitiveColumnNames: true,

    /**
     * @type {boolean}
     */
    resolveAliases: false,

    /**
     * @type {string}
     */
    defaultColumnFilterOperator: '', // blank means use default ('=')

    /**
     * Call this before calling `create` if you want to organize and/or sort your schema.
     */
    deriveSchema: function() {
        this.factory = new ColumnSchemaFactory(this.grid.behavior.columns);
    },
    organizeSchema: function(columnGroupsRegex, options) {
        this.factory.organize(columnGroupsRegex, options);
    },
    sortSchema: function(submenuPlacement) {
        this.factory.sort(submenuPlacement);
    },
    lookupInSchema: function(findOptions, value) {
        return this.factory.lookup(findOptions, value);
    },
    walkSchema: function(iteratee) {
        return this.factory.walk(iteratee);
    },

    /**
     * @param {menuItem[]} [schema] - If omitted, use derived schema. If no derived schema, derive it now.
     */
    create: function(schema) {
        if (!schema) {
            if (!this.factory) {
                this.deriveSchema();
            }
            schema = this.factory.schema;
            delete this.factory; // force new schema each call to create
        }
        return new DefaultFilter({
            schema: schema,
            caseSensitiveData: this.caseSensitiveData,
            caseSensitiveColumnNames: this.caseSensitiveColumnNames,
            resolveAliases: this.resolveAliases,
            defaultColumnFilterOperator: this.defaultColumnFilterOperator
        });
    }
};

window.fin.Hypergrid.Hyperfilter = Hyperfilter;

},{"./js/ColumnSchemaFactory":2,"./js/DefaultFilter":3,"./mix-ins/behavior":5,"./mix-ins/dataModel":6,"./mix-ins/grid":7}],2:[function(require,module,exports){
'use strict';

var popMenu = require('pop-menu');

/**
 * @classdesc Build, organize, and sort a column schema list from a list of columns.
 *
 * FilterTree requires a column schema. As a fallback when you don't have a column schema of your own, the string array returned by behavior.dataModel.getFields() would work as is. This factory object will do a little better than that, taking Hypergrid's column array and creating a more textured column schema, including column aliases and types.
 *
 * CAVEAT: Set up the schema completely before instantiating your filter state. Filter-tree uses the schema (in part) to generate column selection drop-downs as part of its "query builder" UI. Note that the UI is *not* automatically updated if you change the schema later.
 *
 * @param {Column[]} columns
 * @constructor
 */
function ColumnSchemaFactory(columns) {
    /**
     * This is the output produced by the factory.
     * @type {menuItem[]}
     */
    this.schema = columns.map(function(column) {
        var item = {
            name: column.name,
            alias: column.header,
            type: column.getType()
        };

        if (column.calculator) {
            item.calculator = column.calculator;
        }

        return item;
    });
}

var placementPrefixMap = {
    top: '\u0000',
    bottom: '\uffff',
    undefined: ''
};

ColumnSchemaFactory.prototype = {

    constructor: ColumnSchemaFactory.prototype.constructor,

    /**
     * Organize schema into submenus.
     * @param {RegExp} columnGroupsRegex - Schema names or aliases that match this are put into a submenu.
     * @param {string} [options.key='name'] - Must be either 'name' or 'alias'.
     */
    organize: function(columnGroupsRegex, options) {
        var key = options && options.key || 'name',
            submenus = {},
            menu = [];

        this.schema.forEach(function(item) {
            var value = item[key],
                group = value.match(columnGroupsRegex);
            if (group) {
                group = group[0];
                if (!(group in submenus)) {
                    submenus[group] = {
                        label: group.toUpperCase(),
                        submenu: []
                    };
                }
                submenus[group].submenu.push(item);
            } else {
                menu.push(item);
            }
        });

        for (var submenuName in submenus) {
            menu.push(submenus[submenuName]);
        }

        this.schema = menu;
    },

    lookup: function(findOptions, value) {
        return popMenu.lookup.apply(this.schema, arguments);
    },

    walk: function(iteratee) {
        return popMenu.walk.apply(this.schema, arguments);
    },

    /**
     * @summary Sort the schema.
     * @desc Walk the menu structure, sorting each submenu until finally the top-level menu is sorted.
     * @param {boolean} [submenuPlacement] - One of:
     * * `'top'` - Place all the submenus at the top of each enclosing submenu.
     * * `'bottom'` - Place all the submenus at the bottom of each enclosing submenu.
     * * `undefined` (or omitted) - Give no special treatment to submenus.
     */
    sort: function(submenuPlacement) {
        var prefix = placementPrefixMap[submenuPlacement];

        this.schema.sort(function recurse(a, b) {
            if (a.label && !a.sorted) {
                a.submenu.sort(recurse);
                a.sorted = true;
            }
            a = a.label ? prefix + a.label : a.alias || a.name || a;
            b = b.label ? prefix + b.label : b.alias || b.name || b;
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }
};

module.exports = ColumnSchemaFactory;

},{"pop-menu":23}],3:[function(require,module,exports){
'use strict';

var FilterTree = require('filter-tree');
var ParserCQL = require('./parser-CQL');

// Add a property `menuModes` to th e tree, defaulting to `operators` as the only active mode
FilterTree.Node.optionsSchema.menuModes = {
    default: {
        operators: 1
    }
};

// Add `opMenuGroups` to prototype because needed by FilterBox.
FilterTree.Node.prototype.opMenuGroups = FilterTree.Conditionals.groups;

function quote(text) {
    var qt = ParserCQL.qt;
    return qt + text.replace(new RegExp(qt, 'g'), qt + qt) + qt;
}

var likeDresses = [
    { regex: /^(NOT )?LIKE %(.+)%$/i, operator: 'contains' },
    { regex: /^(NOT )?LIKE (.+)%$/i, operator: 'begins' },
    { regex: /^(NOT )?LIKE %(.+)$/i, operator: 'ends' }
];
var regexEscapedLikePatternChars = /\[([_\[\]%])\]/g; // capture all _, [, ], and % chars enclosed in []
var regexLikePatternChar = /[_\[\]%]/; // find any _, [, ], and % chars NOT enclosed in []

// convert certain LIKE expressions to BEGINS, ENDS, CONTAINS
function convertLikeToPseudoOp(result) {
    likeDresses.find(function(dress) {
        var match = result.match(dress.regex);

        if (match) {
            // unescape all LIKE pattern chars escaped with brackets
            var not = (match[1] || '').toLowerCase(),
                operator = dress.operator,
                operand = match[2],
                operandWithoutEscapedChars = operand.replace(regexEscapedLikePatternChars, '');

            // if result has no actua remaining LIKE pattern chars, go with the conversion
            if (!regexLikePatternChar.test(operandWithoutEscapedChars)) {
                operand = operand.replace(regexEscapedLikePatternChars, '$1'); // unescape the escaped chars
                result = not + operator + ' ' + operand;
            }

            return true; // break out of loop
        }
    });

    return result;
}

var conditionalsCQL = new FilterTree.Conditionals();
conditionalsCQL.makeLIKE = function(beg, end, op, originalOp, c) {
    op = originalOp.toLowerCase();
    return op + ' ' + quote(c.operand);
};
conditionalsCQL.makeIN = function(op, c) {
    return op.toLowerCase() + ' (' + c.operand.replace(/\s*,\s*/g, ', ') + ')';
};
conditionalsCQL.make = function(op, c) {
    var numericOperand;
    op = op.toLowerCase();
    if (/\w/.test(op)) { op += ' '; }
    op += c.getType() === 'number' && !isNaN(numericOperand = Number(c.operand))
        ? numericOperand
        : quote(c.operand);
    return op;
};

// replace the default filter tree terminal node constructor with an extension of same
var CustomFilterLeaf = FilterTree.prototype.addEditor({
    getState: function getState(options) {
        var result,
            syntax = options && options.syntax;

        if (syntax === 'CQL') {
            result = this.getSyntax(conditionalsCQL);
            result = convertLikeToPseudoOp(result);
            var defaultOp = this.schema.lookup(this.column).defaultOp || this.root.parserCQL.defaultOp; // mimics logic in parser-CQL.js, line 110
            if (result.toUpperCase().indexOf(defaultOp) === 0) {
                result = result.substr(defaultOp.length);
            }
        } else {
            result = FilterTree.Leaf.prototype.getState.call(this, options);
        }

        return result;
    }
});

FilterTree.prototype.addEditor('Columns');

// Add some node templates by updating shared instance of FilterNode's templates. (OK to mutate shared instance; filter-tree not being used for anything else here. Alternatively, we could have instantiated a new Templates object for our DefaultFilter prototype, although this would only affect tree nodes, not leaf nodes, but that would be ok in this case since the additions below are tree node templates.)
Object.assign(FilterTree.Node.prototype.templates, {
    columnFilter: [
        '<span class="filter-tree">',
        '   <strong><span>{2} </span></strong><br>',
        '   Match',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
        '   <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
        '   of the following:',
        '   <select>',
        '       <option value="">New expression&hellip;</option>',
        '   </select>',
        '   <ol></ol>',
        '</span>'
    ]
        .join('\n'),

    columnFilters: [
        '<span class="filter-tree filter-tree-type-column-filters">',
        '   Match <strong>all</strong> of the following column filter subexpressions:',
        '   <ol></ol>',
        '</span>'
    ]
        .join('\n')
});

/** @constructor
 *
 * @desc This extension of FilterTree forces a specific tree structure.
 * See {@link makeNewRoot} for a description.
 *
 * See also {@tutorial filter-api}.
 *
 * @param {FilterTreeOptionsObject} options - You should provide a column schema. The easiest approach is to provide a schema for the entire filter tree through `options.schema`.
 *
 * Although not recommended, the column schema can also be embedded in the state object, either at the root, `options.state.schema`, or for any descendant node. For example, a separate schema could be provided for each expression or subexpression that need to render column list drop-downs.
 *
 * NOTE: If `options.state` is undefined, it is defined in `preInitialize()` as a new empty state scaffold (see {@link makeNewRoot}) with the two trunks to hold a table filter and column filters. Expressions and subexpressions can be added to this empty scaffold either programmatically or through the Query Builder UI.
 */
var DefaultFilter = FilterTree.extend('DefaultFilter', {
    preInitialize: function(options) {
        options = options || {};

        // Set up the default "Hyperfilter" profile (see function comments)
        var state = options.state = options.state || this.makeNewRoot();

        // Upon creation of a 'columnFilter' node, force the schema to the one column
        if ((options.type || state && state.type) === 'columnFilter') {
            this.schema = [
                options.parent.root.schema.lookup(state.children[0].column)
            ];
        }

        return [options];
    },

    initialize: function(options) {
        this.cache = {};

        if (!this.parent) {
            this.extractSubtrees();
        }
    },

    postInitialize: function(options) {
        if (this === this.root && !this.parserCQL) {
            this.parserCQL = new ParserCQL(this.conditionals.ops, {
                schema: this.schema,
                defaultOp: options.defaultColumnFilterOperator
            });
        }

        if (this.type === 'columnFilter') {
            this.dontPersist.schema = true;
        }
    },

    /**
     * Create convenience vars to reference the 2 root "Hyperfilter" nodes
     * @memberOf DefaultFilter.prototype
     */
    extractSubtrees: function() {
        var rootNodes = this.root.children;
        this.tableFilter = rootNodes[0];
        this.columnFilters = rootNodes[1];
    },

    /**
     * @summary Make a new empty Hypergrid filter tree state object.
     * @desc This function makes a new default state object as used by Hypergrid, a root with exactly two "trunks."
     *
     * > **Definition:** A *trunk* is defined as a child node with a truthy `keep` property, making this node immune to the usual pruning that would occur when it has no child nodes of its own. To be a true trunk, all ancestor nodes to be trunks as well. Note that the root is a natural trunk; it does not require a `keep` property.
     *
     * The two trunks of the Hypergrid filter are:
     * * The **Table Filter** (left trunk, or `children[0]`), a hierarchy of filter expressions and subexpressions.
     * * The **Column Filters** (right trunk, or `children[1]`), a series of subexpressions, one per active column filter. Each subexpression contains any number of expressions bound to that column but no further subexpressions.
     *
     * The `operator` properties for all subexpressions default to `'op-and'`, which means:
     * * All table filter expressions and subexpressions are AND'd together. (This is just the default and may be changed from the UI.)
     * * All expressions within a column filter subexpression are AND'd together. (This is just the default and may be changed from the UI.)
     * * All column Filters subexpressions are AND'd together. (This may not be changed from UI.)
     * * Finally, the table filter and column filters are AND'd together. (This may not be changed from UI.)
     *
     * @returns {object} A plain object to serve as a filter-tree state object representing a new Hypergrid filter.
     *
     * @memberOf DefaultFilter.prototype
     */
    makeNewRoot: function() {

        this.tableFilter = {
            keep: true,
            children: [
                // table filter expressions and subexpressions go here
            ]
        };

        this.columnFilters = {
            keep: true,
            type: 'columnFilters',
            children: [
                // subexpressions with type 'columnFilter' go here, one for each active column filter
            ]
        };

        var filter = {
            children: [
                this.tableFilter,
                this.columnFilters
            ]
        };

        return filter;
    },

    /**
     * @summary Get the column filter subexpression node.
     * @desc Each column filter subexpression node is a child node of the `columnFilters` trunk of the Hypergrid filter tree.
     * Each such node contains all the column filter expressions for the named column. It will never be empty; if there is no column filter for the named column, it won't exist in `columnFilters`.
     *
     * CAUTION: This is the actual node object. Do not confuse it with the column filter _state_ object (for which see the {@link DefaultFilter#getColumnFilterState|getColumnFilterState()} method).
     * @param {string} columnName
     * @returns {undefined|DefaultFilter} Returns `undefined` if the column filter does not exist.
     * @memberOf DefaultFilter.prototype
     */
    getColumnFilter: function(columnName) {
        return this.columnFilters.children.find(function(columnFilter) {
            return columnFilter.children.length && columnFilter.children[0].column === columnName;
        });
    },

    /** @typedef {object} FilterTreeGetStateOptionsObject
     * See the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeGetStateOptionsObject|type definition} in the filter-tree documentation.
     */

    /** @typedef {object} FilterTreeSetStateOptionsObject
     * See the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeSetStateOptionsObject|type definition} in the filter-tree documentation.
     */

    /**
     * @summary Get a particular column filter's state.
     * @param {string} rawColumnName - Column name for case and alias lookup.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getColumnFilterState: function(rawColumnName, options) {
        var result = '',
            columnSchema = this.schema.lookup(rawColumnName);

        if (columnSchema) {
            var subexpression = this.getColumnFilter(columnSchema.name);

            if (subexpression) {
                if (!(options && options.syntax)) {
                    options = options || {};
                    options.syntax = 'CQL';
                }
                result = subexpression.getState(options);
            }
        }

        return result;
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc Adds CQL support to this.getState(). This function throws parser errors.
     *
     * @param {string} columnName
     *
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`this.root.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     *
     * @param {string} rawColumnName - Column name for case and alias lookup.
     *
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     *
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setColumnFilterState`'s default syntax, `'CQL'`, differs from the other get state methods.
     *
     * @memberOf DefaultFilter.prototype
     */
    setColumnFilterState: function(rawColumnName, state, options) {
        var error,
            subexpression;

        var columnName = this.schema.lookup(rawColumnName).name;

        if (!columnName) {
            throw 'Unknown column name "' + rawColumnName + '"';
        }

        subexpression = this.getColumnFilter(columnName);

        if (state) {
            options = Object.assign({}, options); // clone it because we may mutate it below
            options.syntax = options.syntax || 'CQL';

            if (options.syntax === 'CQL') {
                // Convert some CQL state syntax into a filter tree state object.
                // There must be at least one complete expression or `state` will become undefined.
                try {
                    state = this.root.parserCQL.parse(state, columnName);
                    if (state) {
                        options.syntax = 'object';
                    } else {
                        error = new Error('DefaultFilter: No complete expression.');
                    }
                } catch (e) {
                    error = e;
                }
            }

            if (!error) { // parse successful
                if (subexpression) { // subexpression already exists
                    // replace subexpression representing this column
                    subexpression.setState(state, options);
                } else {
                    // add a new subexpression representing this column
                    state = this.parseStateString(state, options); // because .add() only takes object syntax
                    subexpression = this.columnFilters.add(state);
                }

                error = subexpression.invalid(options);
            }
        }

        if (subexpression && (!state || error)) {
            // remove subexpression representing this column
            subexpression.remove();
        }

        if (error) {
            throw error;
        }
    },

    /**
     * @summary Get state of all column filters.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getColumnFiltersState: function(options) {
        if (options && options.syntax === 'CQL') {
            throw 'The CQL syntax is intended for use on a single column filter only. It does not support multiple columns or subexpressions.';
        }
        return this.root.columnFilters.getState(options);
    },

    /**
     * @summary Set state of all column filters.
     * @desc Note that the column filters implementation depends on the nodes having certain meta-data; you should not be calling this without these meta-data being in place. Specifically `type = 'columnFilters'` and  `keep = true` for the column filters subtree and`type = 'columnFilter'` for each individual column filter subexpression. In addition the subtree operators should always be `'op-and'`.
     * @param {string} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     *
     * @returns {undefined|Error|string} `undefined` indicates success.
     *
     * @memberOf DefaultFilter.prototype
     */
    setColumnFiltersState: function(state, options) {
        var error;

        if (state) {
            this.root.columnFilters.setState(state, options);
            error = this.root.columnFilters.invalid(options);
        }

        return error;
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf DefaultFilter.prototype
     */
    getTableFilterState: function(options) {
        if (options && options.syntax === 'CQL') {
            throw 'The CQL syntax is intended for use on a single column filter only. It does not support multiple columns or subexpressions.';
        }
        return this.root.tableFilter.getState(options);
    },

    /**
     * @param {string} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf DefaultFilter.prototype
     */
    setTableFilterState: function(state, options) {
        var error;

        if (state) {
            this.root.tableFilter.setState(state, options);
            error = this.root.tableFilter.invalid(options);
        } else {
            this.root.tableFilter.children.length = 0;
        }

        return error;
    },

    /**
     * @desc The CQL syntax should only be requested for a subtree containing homogeneous column names and no subexpressions.
     *
     * @param {string} [options.syntax='object'] - If `'CQL'`, walks the tree, returning a string suitable for a Hypergrid filter cell. All other values are forwarded to the prototype's `getState` method for further interpretation.
     *
     * NOTE: CQL is not intended to be used outside the context of a `columnFilters` subexpression.
     *
     * @returns {FilterTreeStateObject}
     *
     * @memberOf DefaultFilter.prototype
     */
    getState: function getState(options) {
        var result,
            syntax = options && options.syntax;

        if (syntax === 'CQL') {
            var operator = this.operator.substr(3); // remove the 'op-' prefix
            result = '';
            this.children.forEach(function(child, idx) {
                if (child) {
                    if (child instanceof CustomFilterLeaf) {
                        if (idx) {
                            result += ' ' + operator + ' ';
                        }
                        result += child.getState(options);
                    } else if (child.children.length) {
                        throw new Error('DefaultFilter: Expected a conditional but found a subexpression. Subexpressions are not supported in CQL (Column Query Language, the filter cell syntax).');
                    }
                }
            });
        } else {
            result = FilterTree.prototype.getState.call(this, options);
        }

        return result;
    },

    /** @summary List of filter properties to be treated as first class objects.
     * @desc On filter property set, for a property value that is a function:
     * * If listed here, function it self is assigned to property.
     * * If _not_ listed here, function will be executed to get value to assign to property.
     * @memberOf DefaultFilter.prototype
     */
    firstClassProperties: {
        calculator: true
    },

    /**
     * @implements dataSourceHelperAPI#properties
     * @desc Notes regarding specific properties:
     * * `caseSensitiveData` (root property) pertains to string compares only. This includes untyped columns, columns typed as strings, typed columns containing data that cannot be coerced to type or when the filter expression operand cannot be coerced. This is a shared property and affects all grids managed by this instance of the app.
     * * `calculator` (column property) Computed column calculator.
     *
     * @returns One of:
     * * **Getter** type call: Value of requested property or `null` if undefined.
     * * **Setter** type call: `undefined`
     *
     * @memberOf DefaultFilter.prototype
     */
    properties: function(properties) {
        var result, value,
            object = properties && properties.column
                ? this.schema.lookup(properties.column.name)
                : this.root;

        if (properties && object) {
            if (properties.getPropName) {
                result = object[properties.getPropName];
                if (result === undefined) {
                    result = null;
                }
            } else {
                for (var key in properties) {
                    value = properties[key];
                    if (value === undefined) {
                        delete object[key];
                    } else if (typeof value === 'function' && !this.firstClassProperties[key]) {
                        object[key] = value();
                    } else {
                        object[key] = value;
                    }
                }
            }
        }

        return result;
    }
});


module.exports = DefaultFilter;

},{"./parser-CQL":4,"filter-tree":11}],4:[function(require,module,exports){
'use strict';

var _ = require('object-iterators');

var REGEXP_BOOLS = /\b(AND|OR|NOR)\b/gi,
    EXP = '(.*?)', BR = '\\b',
    PREFIX = '^' + EXP + BR,
    INFIX = BR + EXP + BR,
    POSTFIX = BR + EXP + '$';

function ParserCqlError(message) {
    this.message = message;
}
ParserCqlError.prototype = Object.create(Error.prototype);
ParserCqlError.prototype.name = 'ParserCqlError';

/**
 * @constructor
 *
 * @summary Column Query Language (CQL) parser
 *
 * @author Jonathan Eiten jonathan@openfin.com
 *
 * @desc See {@tutorial CQL} for the grammar.
 *
 * @param {object} operatorsHash - Hash of valid operators.
 * @param {object} [options]
 * @param {menuItem[]} [options.schema] - Column schema for column name/alias validation. Throws an error if name fails validation (but see `resolveAliases`). Omit to skip column name validation.
 * @param {boolean} [options.defaultOp='='] - Default operator for column when not defined in column schema.
 */
function ParserCQL(operatorsHash, options) {
    var operators = [];

    this.schema = options && options.schema;
    this.defaultOp = (options && options.defaultOp || '=').toUpperCase();

    _(operatorsHash).each(function(props, op) {
        if (op !== 'undefined') {
            operators.push(op);
        }
    });

    // Put larger ones first so that in case a smaller one is a substring of a larger one (such as '<' is to '<='), larger one will be matched first.
    operators = operators.sort(descendingByLength);

    // Escape all symbolic (non alpha) operators.
    operators = operators.map(function(op) {
        if (/^[^A-Z]/.test(op)) {
            op = '\\' + op.split('').join('\\');
        }
        return op;
    });

    var symbolicOperators = operators.filter(function(op) { return op[0] === '\\'; }),
        alphaOperators = operators.filter(function(op) { return op[0] !== '\\'; }).join('|');

    if (alphaOperators) {
        alphaOperators = '\\b(' + alphaOperators + ')\\b';
    }
    /** @summary Regex to match any operator.
     * @desc Matches symbolic operators (made up of non-alpha characters) or identifier operators (word-boundary-isolated runs of alphanumeric characters).
     * @type {RegExp}
     */
    this.REGEX_OPERATOR = new RegExp(symbolicOperators.concat(alphaOperators).join('|'), 'ig');

    operators = operators.join('|') // pipe them
        .replace(/\s+/g, '\\s+'); // arbitrary string of whitespace chars -> whitespace regex matcher

    /** @summary Regex to match an operator + optional operator
     * @desc THe operator is optional. The operand may (or may not) be enclosed in parentheses.
     * @desc Match list:
     * 0. _input string_
     * 1. operator
     * 2. outer operand (may include parentheses)
     * 3. inner operand without parentheses (when an operand was given with parentheses)
     * 4. inner operand (when an operand was given without parentheses)
     * @type {RegExp}
     * @private
     * @memberOf ParserCQL.prototype
     */
    this.REGEX_EXPRESSION = new RegExp('^\\s*(' + operators + ')?\\s*(\\(\\s*(.+?)\\s*\\)|(.+?))\\s*$', 'i');

    this.REGEX_LITERAL_TOKENS = new RegExp('\\' + ParserCQL.qt + '(\\d+)' + '\\' + ParserCQL.qt, 'g');

}

/** @summary Operand quotation mark character.
 * @desc Should be a single character (length === 1).
 * @default '"'
 * @type {string}
 */
ParserCQL.qt = '"';

ParserCQL.prototype = {

    constructor: ParserCQL.prototype.constructor,

    /**
     * @summary Extract the boolean operators from an expression chain.
     * @desc Returns list of homogeneous operators transformed to lower case.
     *
     * Throws an error if all the boolean operators in the chain are not identical.
     * @param {string} cql
     * @returns {string[]}
     */
    captureBooleans: function(cql) {
        var booleans = cql.match(REGEXP_BOOLS);
        return booleans && booleans.map(function(bool) {
            return bool.toLowerCase();
        });
    },

    validateBooleans: function(booleans) {
        if (booleans) {
            var heterogeneousOperator = booleans.find(function(op, i) {
                return booleans[i] !== booleans[0];
            });

            if (heterogeneousOperator) {
                throw new ParserCqlError('Expected homogeneous boolean operators. You cannot mix AND, OR, and NOR operators here because the order of operations is ambiguous.\nTip: In Manage Filters, you can group operations with subexpressions in the Query Builder tab or by using parentheses in the SQL tab.');
            }
        }
        return booleans;
    },

    /**
     * @summary Break an expression chain into a list of expressions.
     * @param {string} cql
     * @param {string[]} booleans
     * @returns {string[]}
     */
    captureExpressions: function(cql, booleans) {
        var expressions, re;

        if (booleans) {
            re = new RegExp(PREFIX + booleans.join(INFIX) + POSTFIX, 'i');
            expressions = cql.match(re);
            expressions.shift(); // discard [0] (input)
        } else {
            expressions = [cql];
        }

        return expressions;
    },

    /**
     * @summary Make a list of children out of a list of expressions.
     * @desc Uses only _complete_ expressions (a value OR an operator + a value).
     *
     * Ignores _incomplete_ expressions (empty string OR an operator - a value).
     *
     * @param {string} columnName
     * @param {string[]} expressions
     * @param {string[]} literals - list of literals indexed by token
     *
     * @returns {expressionState[]} where `expressionState` is one of:
     * * `{column: string, operator: string, operand: string}`
     * * `{column: string, operator: string, operand: string, editor: 'Columns'}`
     */
    makeChildren: function(columnName, expressions, literals) {
        var self = this;
        return expressions.reduce(function(children, exp) {
            if (exp) {
                var parts = exp.match(self.REGEX_EXPRESSION);
                if (parts) {
                    var op = parts[1],
                        outerLiteral = parts[2],
                        innerLiteral = parts.slice(3).find(function(part) {
                            return part !== undefined;
                        });

                    op = (op || '').replace(/\s+/g, ' ').trim().toUpperCase();

                    var parenthesized = /^\(.*\)$/.test(outerLiteral),
                        innerOperators = innerLiteral.match(self.REGEX_OPERATOR);

                    if (!parenthesized && innerOperators) {
                        if (op === '' && outerLiteral === innerOperators[0]) {
                            throw new ParserCqlError('Expected an operand.');
                        }

                        throw new ParserCqlError(
                            'Expected operand but found additional operator(s): ' +
                            innerOperators
                                .toString() // convert to comma-separated list
                                .toUpperCase()
                                .replace(/,/g, ', ') // add spaces after the commas
                                .replace(/^([^,]+), ([^,]+)$/, '$1 and $2') // replace only comma with "and"
                                .replace(/(.+,.+), ([^,]+)$/, '$1, and $2') // add "and" after last of several commas
                        );
                    }

                    op = op ||
                        self.schema && self.schema.lookup(columnName).defaultOp || // column's default operator from schema
                        self.defaultOp; // grid's default operator

                    var child = {
                        column: columnName,
                        operator: op
                    };

                    var fieldName = self.schema && self.schema.lookup(innerLiteral);
                    if (fieldName) {
                        child.operand = fieldName.name || fieldName;
                        child.editor = 'Columns';
                    } else {
                        // Find and expand all collapsed literals.
                        child.operand = innerLiteral.replace(self.REGEX_LITERAL_TOKENS, function(match, index) {
                            return literals[index];
                        });
                    }

                    children.push(child);
                }

                return children;
            }
        }, []);
    },

    /**
     * @summary The position of the operator of the expression under the cursor.
     * @param {string} cql - CQL expression under construction.
     * @param {number} cursor - Current cursor's starting position (`input.startSelection`)
     * @returns {{start: number, end: number}}
     */
    getOperatorPosition: function(cql, cursor) {
        // first tokenize literals in case they contain booleans...
        var literals = [];
        cql = tokenizeLiterals(cql, ParserCQL.qt, literals);

        // ...then expand tokens but with x's just for length
        cql = cql.replace(this.REGEX_LITERAL_TOKENS, function(match, index) {
            var length = 1 + literals[index].length + 1; // add quote chars
            return Array(length + 1).join('x');
        });

        var booleans, expressions, position, tabs, end, tab, expression, oldOperator, oldOperatorOffset;

        if ((booleans = this.captureBooleans(cql))) {
            // boolean(s) found so concatenated expressions
            expressions = this.captureExpressions(cql, booleans);
            position = 0;
            tabs = expressions.map(function(expr, idx) { // get starting position of each expression
                var bool = booleans[idx - 1] || '';
                position += expr.length + bool.length;
                return position;
            });

            // find beginning of expression under cursor position
            tabs.find(function(tick, idx) {
                tab = idx;
                return cursor <= tick;
            });

            cursor = tabs[tab - 1] || 0;
            end = cursor += (booleans[tab - 1] || '').length;

            expression = expressions[tab];
        } else {
            // booleans not found so single expression
            cursor = 0;
            end = cql.length;
            expression = cql;
        }

        oldOperatorOffset = expression.search(this.REGEX_OPERATOR);
        if (oldOperatorOffset >= 0) {
            oldOperator = expression.match(this.REGEX_OPERATOR)[0];
            cursor += oldOperatorOffset;
            end = cursor + oldOperator.length;
        }

        return {
            start: cursor,
            end: end
        };
    },

    /**
     * @summary Make a "locked" subexpression definition object from an expression chain.
     * @desc _Locked_ means it is locked to a single field.
     *
     * When there is only a single expression in the chain, the `operator` is omitted (defaults to `'op-and'`).
     *
     * @param {string} cql - A compound CQL expression, consisting of one or more simple expressions all separated by the same logical operator).
     *
     * @param {string} columnName

     * @returns {undefined|{operator: string, children: string[], schema: string[]}}
     * `undefined` when there are no complete expressions
     *
     * @memberOf module:CQL
     */
    parse: function(cql, columnName) {
        // reduce all runs of white space to a single space; then trim
        cql = cql.replace(/\s\s+/g, ' ').trim();

        var literals = [];
        cql = tokenizeLiterals(cql, ParserCQL.qt, literals);

        var booleans = this.validateBooleans(this.captureBooleans(cql)),
            expressions = this.captureExpressions(cql, booleans),
            children = this.makeChildren(columnName, expressions, literals),
            operator = booleans && booleans[0],
            state;

        if (children.length) {
            state = {
                type: 'columnFilter',
                children: children
            };

            if (operator) {
                state.operator = 'op-' + operator;
            }
        }

        return state;
    }
};

function descendingByLength(a, b) {
    return b.length - a.length;
}

/**
 * @summary Collapse literals.
 * @desc Allows reserved words to exist inside a quoted string.
 * Literals are collapsed to a quoted numerical index into the `literals` array.
 * @param {string} text
 * @param {string} qt
 * @param {string[]} literals - Empty array in which to return extracted literals.
 * @returns {string}
 * @memberOf ParserCQL
 * @inner
 */
function tokenizeLiterals(text, qt, literals) {
    literals.length = 0;

    for (
        var i = 0, j = 0, k, innerLiteral;
        (j = text.indexOf(qt, j)) >= 0;
        j += 1 + (i + '').length + 1, i++
    ) {
        k = j;
        do {
            k = text.indexOf(qt, k + 1);
            if (k < 0) {
                throw new ParserCqlError('Quotation marks must be paired; nested quotation marks must be doubled.');
            }
        } while (text[++k] === qt);

        innerLiteral = text
            .slice(++j, --k) // extract
            .replace(new RegExp(qt + qt, 'g'), qt); // unescape escaped quotation marks

        literals.push(innerLiteral);

        text = text.substr(0, j) + i + text.substr(k); // collapse
    }

    return text;
}

module.exports = ParserCQL;

},{"object-iterators":21}],5:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        return this.dataModel.getFilter(columnIndexOrName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state, reapplies the filter to the data source.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        this.dataModel.setFilter(columnIndexOrName, state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getFilters: function(options) {
        return this.dataModel.getFilters(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setFilters: function(state, options) {
        this.dataModel.setFilters(state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior.prototype
     */
    getTableFilter: function(options) {
        return this.dataModel.getTableFilter(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior.prototype
     */
    setTableFilter: function(state, options) {
        this.dataModel.setTableFilter(state, options);
    },

};

},{}],6:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary Get a particular column filter's state.
     * @param {string} columnName
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        var isIndex = !isNaN(Number(columnIndexOrName)),
            columnName = isIndex ? this.schema[columnIndexOrName].name : columnIndexOrName;

        return this.filter.getColumnFilterState(columnName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state, reapplies the filter to the data source.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        var isIndex = !isNaN(Number(columnIndexOrName)),
            columnName = isIndex ? this.schema[columnIndexOrName].name : columnIndexOrName;

        this.filter.setColumnFilterState(columnName, state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getFilters: function(options) {
        return this.filter.getColumnFiltersState(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setFilters: function(state, options) {
        this.filter.setColumnFiltersState(state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf dataModels.JSON.prototype
     */
    getTableFilter: function(options) {
        return this.filter.getTableFilterState(options);
    },

    /**
     * @summary Set a the table filter state.
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf dataModels.JSON.prototype
     */
    setTableFilter: function(state, options) {
        this.filter.setTableFilterState(state, options);
        this.grid.fireSyntheticFilterAppliedEvent();
        this.reindex();
    },

};

},{}],7:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getFilter: function(columnIndexOrName, options) {
        return this.behavior.getFilter(columnIndexOrName, options);
    },

    /**
     * @summary Set a particular column filter's state.
     * @desc After setting the new filter state:
     * * Reapplies the filter to the data source.
     * * Calls `behaviorChanged()` to update the grid canvas.
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {string|object} [state] - A filter tree object or a JSON, SQL, or CQL subexpression string that describes the a new state for the named column filter. The existing column filter subexpression is replaced with a new node based on this state. If it does not exist, the new subexpression is added to the column filters subtree (`filter.columnFilters`).
     *
     * If undefined, removes the entire column filter subexpression from the column filters subtree.
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @param {string} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `setFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setFilter: function(columnIndexOrName, state, options) {
        if (this.cellEditor) {
            this.cellEditor.hideEditor();
        }
        this.behavior.setFilter(columnIndexOrName, state, options);
        this.behaviorChanged();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getFilters: function(options) {
        return this.behavior.getFilters(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setFilters: function(state, options) {
        if (this.cellEditor) {
            this.cellEditor.hideEditor();
        }
        this.behavior.setFilters(state, options);
        this.behaviorChanged();
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Hypergrid.prototype
     */
    getTableFilter: function(options) {
        return this.behavior.getTableFilter(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Hypergrid.prototype
     */
    setTableFilter: function(state, options) {
        this.behavior.setTableFilter(state, options);
        this.behaviorChanged();
    },

};

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
'use strict';

var overrider = require('overrider');

/** @namespace extend-me **/

/** @summary Extends an existing constructor into a new constructor.
 *
 * @returns {ChildConstructor} A new constructor, extended from the given context, possibly with some prototype additions.
 *
 * @desc Extends "objects" (constructors), with optional additional code, optional prototype additions, and optional prototype member aliases.
 *
 * > CAVEAT: Not to be confused with Underscore-style .extend() which is something else entirely. I've used the name "extend" here because other packages (like Backbone.js) use it this way. You are free to call it whatever you want when you "require" it, such as `var inherits = require('extend')`.
 *
 * Provide a constructor as the context and any prototype additions you require in the first argument.
 *
 * For example, if you wish to be able to extend `BaseConstructor` to a new constructor with prototype overrides and/or additions, basic usage is:
 *
 * ```javascript
 * var Base = require('extend-me').Base;
 * var BaseConstructor = Base.extend(basePrototype); // mixes in .extend
 * var ChildConstructor = BaseConstructor.extend(childPrototypeOverridesAndAdditions);
 * var GrandchildConstructor = ChildConstructor.extend(grandchildPrototypeOverridesAndAdditions);
 * ```
 *
 * This function (`extend()`) is added to the new extended object constructor as a property `.extend`, essentially making the object constructor itself easily "extendable." (Note: This is a property of each constructor and not a method of its prototype!)
 *
 * @param {string} [extendedClassName] - This is simply added to the prototype as $$CLASS_NAME. Useful for debugging because all derived constructors appear to have the same name ("Constructor") in the debugger.
 *
 * @param {extendedPrototypeAdditionsObject} [prototypeAdditions] - Object with members to copy to new constructor's prototype.
 *
 * @property {boolean} [debug] - See parameter `extendedClassName` _(above)_.
 *
 * @property {object} Base - A convenient base class from which all other classes can be extended.
 *
 * @memberOf extend-me
 */
function extend(extendedClassName, prototypeAdditions) {
    switch (arguments.length) {
        case 0:
            prototypeAdditions = {};
            break;
        case 1:
            switch (typeof extendedClassName) {
                case 'object':
                    prototypeAdditions = extendedClassName;
                    extendedClassName = undefined;
                    break;
                case 'string':
                    prototypeAdditions = {};
                    break;
                default:
                    throw 'Single-parameter overload must be either string or object.';
            }
            break;
        case 2:
            if (typeof extendedClassName !== 'string' || typeof prototypeAdditions !== 'object') {
                throw 'Two-parameter overload must be string, object.';
            }
            break;
        default:
            throw 'Too many parameters';
    }

    function Constructor() {
        if (prototypeAdditions.preInitialize) {
            prototypeAdditions.preInitialize.apply(this, arguments);
        }

        initializePrototypeChain.apply(this, arguments);

        if (prototypeAdditions.postInitialize) {
            prototypeAdditions.postInitialize.apply(this, arguments);
        }
    }

    Constructor.extend = extend;

    var prototype = Constructor.prototype = Object.create(this.prototype);
    prototype.constructor = Constructor;

    if (extendedClassName) {
        prototype.$$CLASS_NAME = extendedClassName;
    }

    overrider(prototype, prototypeAdditions);

    return Constructor;
}

function Base() {}
Base.prototype = {
    constructor: Base.prototype.constructor,
    get super() {
        return Object.getPrototypeOf(Object.getPrototypeOf(this));
    }
};
Base.extend = extend;
extend.Base = Base;

/** @typedef {function} extendedConstructor
 * @property prototype.super - A reference to the prototype this constructor was extended from.
 * @property [extend] - If `prototypeAdditions.extendable` was truthy, this will be a reference to {@link extend.extend|extend}.
 */

/** @typedef {object} extendedPrototypeAdditionsObject
 * @desc All members are copied to the new object. The following have special meaning.
 * @property {function} [initialize] - Additional constructor code for new object. This method is added to the new constructor's prototype. Gets passed new object as context + same args as constructor itself. Called on instantiation after similar function in all ancestors called with same signature.
 * @property {function} [preInitialize] - Called before the `initialize` cascade. Gets passed new object as context + same args as constructor itself.
 * @property {function} [postInitialize] - Called after the `initialize` cascade. Gets passed new object as context + same args as constructor itself.
 */

/** @summary Call all `initialize` methods found in prototype chain, beginning with the most senior ancestor's first.
 * @desc This recursive routine is called by the constructor.
 * 1. Walks back the prototype chain to `Object`'s prototype
 * 2. Walks forward to new object, calling any `initialize` methods it finds along the way with the same context and arguments with which the constructor was called.
 * @private
 * @memberOf extend-me
 */
function initializePrototypeChain() {
    var term = this,
        args = arguments;
    recur(term);

    function recur(obj) {
        var proto = Object.getPrototypeOf(obj);
        if (proto.constructor !== Object) {
            recur(proto);
            if (proto.hasOwnProperty('initialize')) {
                proto.initialize.apply(term, args);
            }
        }
    }
}

module.exports = extend;

},{"overrider":22}],10:[function(require,module,exports){
'use strict';

exports['column-CQL-syntax'] = [
'<li>',
'	<button type="button" class="copy"></button>',
'	<div class="filter-tree-remove-button" title="delete conditional"></div>',
'	{1}:',
'	<input name="{2}" class="{4}" value="{3:encode}">',
'</li>'
].join('\n');

exports['column-SQL-syntax'] = [
'<li>',
'	<button type="button" class="copy"></button>',
'	<div class="filter-tree-remove-button" title="delete conditional"></div>',
'	{1}:',
'	<textarea name="{2}" rows="1" class="{4}">{3:encode}</textarea>',
'</li>'
].join('\n');

exports.columnFilter = [
'<span class="filter-tree">',
'	 <strong><span>{2} </span>column filter subexpression:</strong><br>',
'	 Match',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
'	 of the following:',
'	 <select>',
'		 <option value="">New expression&hellip;</option>',
'	 </select>',
'	 <ol></ol>',
' </span>'
].join('\n');

exports.columnFilters = [
'<span class="filter-tree filter-tree-type-column-filters">',
'	 Match <strong>all</strong> of the following column filters:',
'	 <ol></ol>',
' </span>'
].join('\n');

exports.lockedColumn = [
'<span>',
'	 {1:encode}',
'	 <input type="hidden" value="{2}">',
' </span>'
].join('\n');

exports.note = [
'<div class="footnotes">',
'	<div class="footnote"></div>',
'	<p>Select a new value or delete the expression altogether.</p>',
'</div>'
].join('\n');

exports.notes = [
'<div class="footnotes">',
'	<p>Note the following error conditions:</p>',
'	<ul class="footnote"></ul>',
'	<p>Select new values or delete the expression altogether.</p>',
'</div>'
].join('\n');

exports.optionMissing = [
'The requested value of <span class="field-name">{1:encode}</span>',
'(<span class="field-value">{2:encode}</span>) is not valid.'
].join('\n');

exports.removeButton = [
'<div class="filter-tree-remove-button" title="delete conditional"></div>'
].join('\n');

exports.subtree = [
'<span class="filter-tree">',
'	 Match',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-or">any</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-and">all</label>',
'	 <label><input type="radio" class="filter-tree-op-choice" name="treeOp{1}" value="op-nor">none</label>',
'	 of the following:',
'	 <select>',
'		 <option value="">New expression&hellip;</option>',
'		 <option value="subexp" style="border-bottom:1px solid black">Subexpression</option>',
'	 </select>',
'	 <ol></ol>',
' </span>'
].join('\n');

},{}],11:[function(require,module,exports){
'use strict';

var _ = require('object-iterators');
var popMenu = require('pop-menu');

var FilterTree = require('./js/FilterTree');
FilterTree.Node = require('./js/FilterNode'); // aka: Object.getPrototypeOf(FilterTree.prototype).constructor
FilterTree.Leaf = require('./js/FilterLeaf'); // aka: FilterTree.prototype.editors.Default

// expose some objects for plug-in access

FilterTree.Conditionals = require('./js/Conditionals');

// FOLLOWING PROPERTIES ARE *** TEMPORARY ***,
// FOR THE DEMO TO ACCESS THESE NODE MODULES.

FilterTree._ = _;
FilterTree.popMenu = popMenu;


module.exports = FilterTree;

},{"./js/Conditionals":12,"./js/FilterLeaf":13,"./js/FilterNode":14,"./js/FilterTree":15,"object-iterators":21,"pop-menu":23}],12:[function(require,module,exports){
/** @module conditionals */

'use strict';

var Base = require('extend-me').Base;
var _ = require('object-iterators');
var regExpLIKE = require('regexp-like');

var IN = 'IN',
    NOT_IN = 'NOT ' + IN,
    LIKE = 'LIKE',
    NOT_LIKE = 'NOT ' + LIKE,
    LIKE_WILD_CARD = '%',
    NIL = '';

var toString;

var defaultIdQts = {
    beg: '"',
    end: '"'
};


/**
 * @constructor
 */
var Conditionals = Base.extend({
    /**
     * @param {sqlIdQtsObject} [options.sqlIdQts={beg:'"',end:'"'}]
     * @memberOf Conditionals#
     */
    initialize: function(options) {
        var idQts = options && options.sqlIdQts;
        if (idQts) {
            this.sqlIdQts = idQts; // only override if defined
        }
    },

    sqlIdQts: defaultIdQts,
    /**
     * @param id
     * @returns {string}
     * @memberOf Conditionals#
     */
    makeSqlIdentifier: function(id) {
        return this.sqlIdQts.beg + id + this.sqlIdQts.end;
    },

    /**
     * @param string
     * @returns {string}
     * @memberOf Conditionals#
     */
    makeSqlString: function(string) {
        return '\'' + sqEsc(string) + '\'';
    },

    /**
     * @memberOf Conditionals#
     */
    makeLIKE: function(beg, end, op, originalOp, c) {
        var escaped = c.operand.replace(/([_\[\]%])/g, '[$1]'); // escape all LIKE reserved chars
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + this.makeSqlString(beg + escaped + end);
    },

    /**
     * @memberOf Conditionals#
     */
    makeIN: function(op, c) {
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + '(\'' + sqEsc(c.operand).replace(/\s*,\s*/g, '\', \'') + '\')';
    },

    /**
     * @memberOf Conditionals#
     */
    make: function(op, c) {
        return this.makeSqlIdentifier(c.column) +
            ' ' + op +
            ' ' + c.makeSqlOperand();
    }
});

var ops = Conditionals.prototype.ops = {
    undefined: {
        test: function() { return true; },
        make: function() { return ''; }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<': {
        test: function(a, b) { return a < b; },
        make: function(c) { return this.make('<', c); }
    },
    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<=': {
        test: function(a, b) { return a <= b; },
        make: function(c) { return this.make('<=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '=': {
        test: function(a, b) { return a === b; },
        make: function(c) { return this.make('=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '>=': {
        test: function(a, b) { return a >= b; },
        make: function(c) { return this.make('>=', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '>': {
        test: function(a, b) { return a > b; },
        make: function(c) { return this.make('>', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    '<>': {
        test: function(a, b) { return a !== b; },
        make: function(c) { return this.make('<>', c); }
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    LIKE: {
        test: function(a, b) { return regExpLIKE.cached(b, true).test(a); },
        make: function(c) { return this.make(LIKE, c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT LIKE': {
        test: function(a, b) { return !regExpLIKE.cached(b, true).test(a); },
        make: function(c) { return this.make(NOT_LIKE, c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    IN: { // TODO: currently forcing string typing; rework calling code to respect column type
        test: function(a, b) { return inOp(a, b) >= 0; },
        make: function(c) { return this.makeIN(IN, c); },
        operandList: true,
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT IN': { // TODO: currently forcing string typing; rework calling code to respect column type
        test: function(a, b) { return inOp(a, b) < 0; },
        make: function(c) { return this.makeIN(NOT_IN, c); },
        operandList: true,
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    CONTAINS: {
        test: function(a, b) { return containsOp(a, b) >= 0; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, LIKE_WILD_CARD, LIKE, 'CONTAINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT CONTAINS': {
        test: function(a, b) { return containsOp(a, b) < 0; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, LIKE_WILD_CARD, NOT_LIKE, 'NOT CONTAINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    BEGINS: {
        test: function(a, b) { b = toString(b); return beginsOp(a, b.length) === b; },
        make: function(c) { return this.makeLIKE(NIL, LIKE_WILD_CARD, LIKE, 'BEGINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT BEGINS': {
        test: function(a, b) { b = toString(b); return beginsOp(a, b.length) !== b; },
        make: function(c) { return this.makeLIKE(NIL, LIKE_WILD_CARD, NOT_LIKE, 'NOT BEGINS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    ENDS: {
        test: function(a, b) { b = toString(b); return endsOp(a, b.length) === b; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, NIL, LIKE, 'ENDS', c); },
        type: 'string'
    },

    /** @type {relationalOperator}
     * @memberOf Conditionals#
     */
    'NOT ENDS': {
        test: function(a, b) { b = toString(b); return endsOp(a, b.length) !== b; },
        make: function(c) { return this.makeLIKE(LIKE_WILD_CARD, NIL, NOT_LIKE, 'NOT ENDS', c); },
        type: 'string'
    }
};

// some synonyms
ops['\u2264'] = ops['<='];  // UNICODE 'LESS-THAN OR EQUAL TO'
ops['\u2265'] = ops['>='];  // UNICODE 'GREATER-THAN OR EQUAL TO'
ops['\u2260'] = ops['<>'];  // UNICODE 'NOT EQUAL TO'

function inOp(a, b) {
    return b
        .trim() // remove leading and trailing space chars
        .replace(/\s*,\s*/g, ',') // remove any white-space chars from around commas
        .split(',') // put in an array
        .indexOf((a + '')); // search array whole matches
}

function containsOp(a, b) {
    return toString(a).indexOf(toString(b));
}

function beginsOp(a, length) {
    return toString(a).substr(0, length);
}

function endsOp(a, length) {
    return toString(a).substr(-length, length);
}

function sqEsc(string) {
    return string.replace(/'/g, '\'\'');
}

var groups = {
    equality: {
        label: 'Equality',
        submenu: ['=']
    },
    inequalities: {
        label: 'Inequalities',
        submenu: [
            '<',
            '\u2264', // UNICODE 'LESS-THAN OR EQUAL TO'; on a Mac, type option-comma (≤)
            '\u2260', // UNICODE 'NOT EQUALS'; on a Mac, type option-equals (≠)
            '\u2265', // UNICODE 'GREATER-THAN OR EQUAL TO'; on a Mac, type option-period (≥)
            '>'
        ]
    },
    sets: {
        label: 'Set scans',
        submenu: ['IN', 'NOT IN']
    },
    strings: {
        label: 'String scans',
        submenu: [
            'CONTAINS', 'NOT CONTAINS',
            'BEGINS', 'NOT BEGINS',
            'ENDS', 'NOT ENDS'
        ]
    },
    patterns: {
        label: 'Pattern scans',
        submenu: ['LIKE', 'NOT LIKE']
    }
};

// add a `name` prop to each group
_(groups).each(function(group, key) { group.name = key; });

/**
 * @memberOf Conditionals
 */
Conditionals.groups = groups;

/** Default operator menu when consisting of all of the groups in {@link module:conditionals.groups|groups}. This menu is used when none of the following is otherwise defined:
 * * The `opMenu` property of the column schema.
 * * The entry in the node's `typeOpMap` hash corresponding to the `type` property of the column schema.
 * * The node's `treeOpMenu` object.
 * @type {menuItem[]}
 * @memberOf Conditionals
 */
Conditionals.defaultOpMenu = [ // hierarchical menu of relational operators
    groups.equality,
    groups.inequalities,
    groups.sets,
    groups.strings,
    groups.patterns
];


// Meant to be called by FilterTree.prototype.setSensitivity only
Conditionals.setToString = function(fn) {
    return (toString = fn);
};

module.exports = Conditionals;

},{"extend-me":9,"object-iterators":21,"regexp-like":24}],13:[function(require,module,exports){
/* eslint-env browser */
/* eslint-disable key-spacing */

'use strict';

var popMenu = require('pop-menu');

var FilterNode = require('./FilterNode');
var Conditionals = require('./Conditionals');


var toString; // set by FilterLeaf.setToString() called from ../index.js


/** @typedef {object} converter
 * @property {function} toType - Returns input value converted to type. Fails silently.
 * @property {function} failed - Tests input value against type, returning `false if type or `true` if not type.
 */

/** @type {converter} */
var numberConverter = {
    toType: Number,
    failed: isNaN
};

/** @type {converter} */
var dateConverter = {
    toType: function(s) { return new Date(s); },
    failed: isNaN
};

/**
 * @typedef {object} filterLeafViewObject
 *
 * @property {HTMLElement} column - A drop-down with options from the `FilterLeaf` instance's schema. Value is the name of the column being tested (i.e., the column to which this conditional expression applies).
 *
 * @property operator - A drop-down with options from {@link columnOpMenu}, {@link typeOpMap}, or {@link treeOpMenu}. Value is the string representation of the operator.
 *
 * @property operand - An input element, such as a drop-down or a text box.
 */

/** @constructor
 * @summary An object that represents a conditional expression node in a filter tree.
 * @desc This object represents a conditional expression. It is always a terminal node in the filter tree; it has no child nodes of its own.
 *
 * A conditional expression is a simple dyadic expression with the following syntax in the UI:
 *
 * > _column operator operand_
 *
 * where:
 * * _column_ is the name of a column from the data row object
 * * _operator_ is the name of an operator from the node's operator list
 * * _operand_ is a literal value to compare against the value in the named column
 *
 * **NOTE:** The {@link ColumnLeaf} extension of this object has a different implementation of _operand_ which is: The name of a column from which to fetch the compare value (from the same data row object) to compare against the value in the named column. See *Extending the conditional expression object* in the {@link http://joneit.github.io/filter-tree/index.html|readme}.
 *
 * The values of the terms of the expression above are stored in the first three properties below. Each of these three properties is set either by `setState()` or by the user via a control in `el`. Note that these properties are not dynamically bound to the UI controls; they are updated by the validation function, `invalid()`.
 *
 * **See also the properties of the superclass:** {@link FilterNode}
 *
 * @property {string} column - Name of the member in the data row objects against which `operand` will be compared. Reflects the value of the `view.column` control after validation.
 *
 * @property {string} operator - Operator symbol. This must match a key in the `this.root.conditionals.ops` hash. Reflects the value of the `view.operator` control after validation.
 *
 * @property {string} operand - Value to compare against the the member of data row named by `column`. Reflects the value of the `view.operand` control, after validation.
 *
 * @property {string} name - Used to describe the object in the UI so user can select an expression editor.
 *
 * @property {string} [type='string'] - The data type of the subexpression if neither the operator nor the column schema defines a type.
 *
 * @property {HTMLElement} el - A `<span>...</span>` element that contains the UI controls. This element is automatically appeneded to the parent `FilterTree`'s `el`. Generated by {@link FilterLeaf#createView|createView}.
 *
 * @property {filterLeafViewObject} view - A hash containing direct references to the controls in `el`. Added by {@link FilterLeaf#createView|createView}.
 */
var FilterLeaf = FilterNode.extend('FilterLeaf', {

    name: 'column = value', // display string for drop-down

    destroy: function() {
        if (this.view) {
            for (var key in this.view) {
                this.view[key].removeEventListener('change', this.onChange);
            }
        }
    },

    /** @summary Create a new view.
     * @desc This new "view" is a group of HTML `Element` controls that completely describe the conditional expression this object represents. This method creates the view, setting `this.el` to point to it, and the members of `this.view` to point to the individual controls therein.
     * @memberOf FilterLeaf#
     */
    createView: function(state) {
        var el = this.el = document.createElement('span');

        el.className = 'filter-tree-editor filter-tree-default';

        if (state && state.column) {
            // State includes column:
            // Operator menu is built later in loadState; we don't need to build it now. The call to
            // getOpMenu below with undefined columnName returns [] resulting in an empty drop-down.
        } else {
            // When state does NOT include column, it's because either:
            // a. column is unknown and op menu will be empty until user chooses a column; or
            // b. column is hard-coded when there's only one possible column as inferable from schema:
            var schema = this.schema && this.schema.length === 1 && this.schema[0],
                columnName = schema && schema.name || schema;
        }

        this.view = {
            column: this.makeElement(this.schema, 'column', this.sortColumnMenu),
            operator: this.makeElement(getOpMenu.call(this, columnName), 'operator'),
            operand: this.makeElement()
        };

        el.appendChild(document.createElement('br'));
    },

    loadState: function(state) {
        var value, el, i, b, selected, ops, thisOp, opMenu, notes;
        if (state) {
            notes = [];
            for (var key in state) {
                if (!FilterNode.optionsSchema[key]) {
                    value = this[key] = state[key];
                    el = this.view[key];
                    switch (el.type) {
                        case 'checkbox':
                        case 'radio':
                            el = document.querySelectorAll('input[name=\'' + el.name + '\']');
                            for (i = 0; i < el.length; i++) {
                                el[i].checked = value.indexOf(el[i].value) >= 0;
                            }
                            break;
                        case 'select-multiple':
                            el = el.options;
                            for (i = 0, b = false; i < el.length; i++, b = b || selected) {
                                selected = value.indexOf(el[i].value) >= 0;
                                el[i].selected = selected;
                            }
                            FilterNode.setWarningClass(el, b);
                            break;
                        default:
                            el.value = value;
                            if (el.value === '' && key === 'operator') {
                                // Operator may be a synonym.
                                ops = this.root.conditionals.ops;
                                thisOp = ops[value];
                                opMenu = getOpMenu.call(this, state.column || this.column);
                                // Check each menu item's op object for equivalency to possible synonym's op object.
                                popMenu.walk.call(opMenu, equiv);
                            }
                            if (!FilterNode.setWarningClass(el)) {
                                notes.push({ key: key, value: value });
                            } else if (key === 'column') {
                                makeOpMenu.call(this, value);
                            }
                    }
                }
            }
            if (notes.length) {
                var multiple = notes.length > 1,
                    templates = this.templates,
                    footnotes = templates.get(multiple ? 'notes' : 'note'),
                    inner = footnotes.querySelector('.footnote');
                notes.forEach(function(note) {
                    var footnote = multiple ? document.createElement('li') : inner;
                    note = templates.get('optionMissing', note.key, note.value);
                    while (note.length) { footnote.appendChild(note[0]); }
                    if (multiple) { inner.appendChild(footnote); }
                });
            }
            this.notesEl = footnotes;
        }
        function equiv(opMenuItem) {
            var opName = opMenuItem.name || opMenuItem;
            if (ops[opName] === thisOp) {
                el.value = opName;
            }
        }
    },

    /**
     * @property {converter} number
     * @property {converter} int - synonym of `number`
     * @property {converter} float - synonym of `number`
     * @property {converter} date
     * @property {converter} string
     */
    converters: {
        number: numberConverter,
        int: numberConverter,
        float: numberConverter,
        date: dateConverter
    },

    /**
     * Called by the parent node's {@link FilterTree#invalid|invalid()} method, which catches the error thrown when invalid.
     *
     * Also performs the following compilation actions:
     * * Copies all `this.view`' values from the DOM to similarly named properties of `this`.
     * * Pre-sets `this.op` and `this.converter` for use in `test`'s tree walk.
     *
     * @param {boolean} [options.throw=false] - Throw an error if missing or invalid value.
     * @param {boolean} [options.focus=false] - Move focus to offending control.
     * @returns {undefined} This is the normal return when valid; otherwise throws error when invalid.
     * @memberOf FilterLeaf#
     */
    invalid: function(options) {
        var elementName, type, focused;

        for (elementName in this.view) {
            var el = this.view[elementName],
                value = controlValue(el).trim();

            if (
                value === '' && elementName === 'operator' && // not in operator menu
                this.root.conditionals.ops[this.operator] && // but valid in operator hash
                !getProperty.call(this, this.column, 'opMustBeInMenu') // and is doesn't have to be in menu to be valid
            ) {
                value = this.operator; // use it as is then
            }

            if (value === '') {
                if (!focused && options && options.focus) {
                    clickIn(el);
                    focused = true;
                }
                if (options && options.throw) {
                    throw new this.Error('Missing or invalid ' + elementName + ' in conditional expression. Complete the expression or remove it.', this);
                }
            } else {
                // Copy each controls's value as a new similarly named property of this object.
                this[elementName] = value;
            }
        }

        this.op = this.root.conditionals.ops[this.operator];

        type = this.getType();

        this.converter = type && type !== 'string' && this.converters[type];

        this.calculator = this.getCalculator();
    },

    getType: function() {
        return this.op.type || getProperty.call(this, this.column, 'type');
    },

    getCalculator: function() {
        return getProperty.call(this, this.column, 'calculator');
    },

    valOrFunc: function(columnName) {
        var result, calculator;
        if (this) {
            result = this[columnName];
            calculator = (typeof result)[0] === 'f' && result || this.calculator;
            if (calculator) {
                result = calculator.call(this, columnName);
            }
        }
        return result || result === 0 || result === false ? result : '';
    },

    p: function(dataRow) {
        return this.valOrFunc.call(dataRow, this.column);
    },

    // To be overridden when operand is a column name (see columns.js).
    q: function() {
        return this.operand;
    },

    test: function(dataRow) {
        var p, q, // untyped versions of args
            P, Q, // typed versions of p and q
            converter;

        // TODO: If a literal (i.e., when this.q is not overridden), q only needs to be fetched ONCE for all rows
        return (
            (p = this.p(dataRow)) === undefined ||
            (q = this.q(dataRow)) === undefined
        )
            ? false // data inaccessible so exclude row
            : (
                (converter = this.converter) &&
                !converter.failed(P = converter.toType(p)) && // attempt to convert data to type
                !converter.failed(Q = converter.toType(q))
            )
                ? this.op.test(P, Q) // both conversions successful: compare as types
                : this.op.test(toString(p), toString(q)); // one or both conversions failed: compare as strings
    },

    toJSON: function() {
        var state = {};
        if (this.editor) {
            state.editor = this.editor;
        }
        for (var key in this.view) {
            state[key] = this[key];
        }
        if (this.schema !== this.parent.schema) {
            state.schema = this.schema;
        }
        return state;
    },

    /**
     * For `'object'` and `'JSON'` note that the subtree's version of `getState` will not call this leaf version of `getState` because the former uses `unstrungify()` and `JSON.stringify()`, respectively, both of which recurse and call `toJSON()` on their own.
     *
     * @param {object} [options='object'] - See the subtree version of {@link FilterTree#getState|getState} for more info.
     *
     * @memberOf FilterLeaf#
     */
    getState: function getState(options) {
        var result = '',
            syntax = options && options.syntax || 'object';

        switch (syntax) {
            case 'object': // see note above
                result = this.toJSON();
                break;
            case 'JSON': // see note above
                result = JSON.stringify(this, null, options && options.space) || '';
                break;
            case 'SQL':
                result = this.getSyntax(this.root.conditionals);
        }

        return result;
    },

    makeSqlOperand: function() {
        return this.root.conditionals.makeSqlString(this.operand); // todo: this should be a number if type is number instead of a string -- but we will have to ensure it is numeric!
    },

    getSyntax: function(conditionals) {
        return this.root.conditionals.ops[this.operator].make.call(conditionals, this);
    },

    /** @summary HTML form controls factory.
     * @desc Creates and appends a text box or a drop-down.
     * > Defined on the FilterTree prototype for access by derived types (alternate filter editors).
     * @returns The new element.
     * @param {menuItem[]} [menu] - Overloads:
     * * If omitted, will create an `<input/>` (text box) element.
     * * If contains only a single option, will create a `<span>...</span>` element containing the string and a `<input type=hidden>` containing the value.
     * * Otherwise, creates a `<select>...</select>` element with these menu items.
     * @param {null|string} [prompt=''] - Adds an initial `<option>...</option>` element to the drop-down with this value, parenthesized, as its `text`; and empty string as its `value`. Omitting creates a blank prompt; `null` suppresses.
     * @param [sort]
     * @memberOf FilterLeaf#
     */
    makeElement: function(menu, prompt, sort) {
        var el, result, options,
            option = menu,
            tagName = menu ? 'SELECT' : 'INPUT';

        // determine if there would be only a single item in the dropdown
        while (option instanceof Array) {
            if (option.length === 1 && !popMenu.isGroupProxy(option[0])) {
                option = option[0];
            } else {
                option = undefined;
            }
        }

        if (option) {
            // hard text when single item
            el = this.templates.get(
                'lockedColumn',
                option.alias || option.name || option,
                option.name || option.alias || option
            );
            result = el.querySelector('input');
        } else {
            options = {
                prompt: prompt,
                sort: sort,
                group: function(groupName) { return Conditionals.groups[groupName]; }
            };

            // make an element
            el = popMenu.build(tagName, menu, options);

            // if it's a textbox, listen for keyup events
            if (el.type === 'text' && this.eventHandler) {
                this.el.addEventListener('keyup', this.eventHandler);
            }

            // handle onchange events
            this.onChange = this.onChange || cleanUpAndMoveOn.bind(this);
            this.el.addEventListener('change', this.onChange);

            FilterNode.setWarningClass(el);
            result = el;
        }

        this.el.appendChild(el);

        return result;
    }
});

/** `change` event handler for all form controls.
 * Rebuilds the operator drop-down as needed.
 * Removes error CSS class from control.
 * Adds warning CSS class from control if blank; removes if not blank.
 * Adds warning CSS class from control if blank; removes if not blank.
 * Moves focus to next non-blank sibling control.
 * @this {FilterLeaf}
 */
function cleanUpAndMoveOn(evt) {
    var el = evt.target;

    // remove `error` CSS class, which may have been added by `FilterLeaf.prototype.invalid`
    el.classList.remove('filter-tree-error');

    // set or remove 'warning' CSS class, as per el.value
    FilterNode.setWarningClass(el);

    if (el === this.view.column) {
        // rebuild operator list according to selected column name or type, restoring selected item
        makeOpMenu.call(this, el.value);
    }

    if (el.value) {
        // find next sibling control, if any
        if (!el.multiple) {
            while ((el = el.nextElementSibling) && (!('name' in el) || el.value.trim() !== '')); // eslint-disable-line curly
        }

        // and click in it (opens select list)
        if (el && el.value.trim() === '') {
            el.value = ''; // rid of any white space
            FilterNode.clickIn(el);
        }
    }

    // forward the event to the application's event handler
    if (this.eventHandler) {
        this.eventHandler(evt);
    }
}

/**
 * @summary Get the node property.
 * @desc Priority ladder:
 * 1. Schema property.
 * 2. Mixin (if given).
 * 3. Node property is final priority.
 * @this {FilterLeaf}
 * @param {string} columnName
 * @param {string} propertyName
 * @param {function|boolean} [mixin] - Optional function or value if schema property undefined. If function, called in context with `propertyName` and `columnName`.
 * @returns {object}
 */
function getProperty(columnName, propertyName, mixin) {
    var columnSchema = this.schema.lookup(columnName) || {};
    return (
        columnSchema[propertyName] // the expression's column schema property
            ||
        typeof mixin === 'function' && mixin.call(this, columnSchema, propertyName)
            ||
        typeof mixin !== 'function' && mixin
            ||
        this[propertyName] // the expression node's property
    );
}

/**
 * @this {FilterLeaf}
 * @param {string} columnName
 * @returns {undefined|menuItem[]}
 */
function getOpMenu(columnName) {
    return getProperty.call(this, columnName, 'opMenu', function(columnSchema) {
        return this.typeOpMap && this.typeOpMap[columnSchema.type || this.type];
    });
}

/**
 * @this {FilterLeaf}
 * @param {string} columnName
 */
function makeOpMenu(columnName) {
    var opMenu = getOpMenu.call(this, columnName);

    if (opMenu !== this.renderedOpMenu) {
        var newOpDrop = this.makeElement(opMenu, 'operator');

        newOpDrop.value = this.view.operator.value;
        this.el.replaceChild(newOpDrop, this.view.operator);
        this.view.operator = newOpDrop;

        FilterNode.setWarningClass(newOpDrop);

        this.renderedOpMenu = opMenu;
    }
}

function clickIn(el) {
    setTimeout(function() {
        el.classList.add('filter-tree-error');
        FilterNode.clickIn(el);
    }, 0);
}

function controlValue(el) {
    var value, i;

    switch (el.type) {
        case 'checkbox':
        case 'radio':
            el = document.querySelectorAll('input[name=\'' + el.name + '\']:enabled:checked');
            for (value = [], i = 0; i < el.length; i++) {
                value.push(el[i].value);
            }
            break;

        case 'select-multiple':
            el = el.options;
            for (value = [], i = 0; i < el.length; i++) {
                if (!el.disabled && el.selected) {
                    value.push(el[i].value);
                }
            }
            break;

        default:
            value = el.value;
    }

    return value;
}

// Meant to be called by FilterTree.prototype.setSensitivity only
FilterLeaf.setToString = function(fn) {
    toString = fn;
    return Conditionals.setToString(fn);
};


module.exports = FilterLeaf;

},{"./Conditionals":12,"./FilterNode":14,"pop-menu":23}],14:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var _ = require('object-iterators');
var extend = require('extend-me'), Base = extend.Base; extend.debug = true;
var popMenu = require('pop-menu');

var cssInjector = require('./stylesheet');
var Templates = require('./Templates');
var Conditionals = require('./Conditionals');
var ParserSQL = require('./parser-SQL');


var CHILDREN_TAG = 'OL',
    CHILD_TAG = 'LI';

// JSON-detector: begins _and_ ends with either [ and ] _or_ { and }
var reJSON = /^\s*((\[[^]*\])|(\{[^]*\}))\s*$/;

function FilterTreeError(message, node) {
    this.message = message;
    this.node = node;
}
FilterTreeError.prototype = Object.create(Error.prototype);
FilterTreeError.prototype.name = 'FilterTreeError';

/** @typedef {object} FilterTreeSetStateOptionsObject
 *
 * @property {boolean} [syntax='auto'] - Specify parser to use on `state`. One of:
 * * `'auto'` - Auto-detect; see {@link FilterNode#parseStateString} for algorithm.
 * * `'object'` - A raw state object such as that produced by the [getState()]{@link FilterTree#getState} method.
 * * `'JSON'` - A JSON string version of a state object such as that produced by the [getState()]{@link FilterTree#getState} method.
 * * `'SQL'` - A SQL [search condition expression]{@link https://msdn.microsoft.com/en-us/library/ms173545.aspx} string.
 *
 * @param {Element} [context] If defined, the provided input string is used as a selector to an `HTMLElement` contained in `context`. The `value` property of this element is fetched from the DOM and is used as the input state string; proceed as above.
 */

/** @typedef {object} FilterTreeOptionsObject
 *
 * @property {menuItem[]} [schema] - A default list of column names for field drop-downs of all descendant terminal nodes. Overrides `options.state.schema` (see). May be defined for any node and pertains to all descendants of that node (including terminal nodes). If omitted (and no `ownSchema`), will use the nearest ancestor `schema` definition. However, descendants with their own definition of `types` will override any ancestor definition.
 *
 * > Typically only used by the caller for the top-level (root) tree.
 *
 * @property {menuItem[]} [ownSchema] - A default list of column names for field drop-downs of immediate descendant terminal nodes _only_. Overrides `options.state.ownSchema` (see).
 *
 * Although both `options.schema` and `options.ownSchema` are notated as optional herein, by the time a terminal node tries to render a schema drop-down, a `schema` list should be defined through (in order of priority):
 *
 * * Terminal node's own `options.schema` (or `options.state.schema`) definition.
 * * Terminal node's parent node's `option.ownSchema` (or `option.state.nodesFields`) definition.
 * * Terminal node's parent (or any ancestor) node's `options.schema` (or `options.state.schema`) definition.
 *
 * @property {FilterTreeStateObject} [state] - A data structure that describes a tree, subtree, or leaf (terminal node). If undefined, loads an empty filter, which is a `FilterTree` node consisting the default `operator` value (`'op-and'`).
 *
 * @property {function} [editor='Default'] - The name of the conditional expression's UI "editor." This name must be registered in the parent node's {@link FilterTree#editors|editors} hash, where it maps to a leaf constructor (`FilterLeaf` or a descendant thereof). (Use {@link FilterTree#addEditor} to register new editors.)
 *
 * @property {FilterTree} [parent] - Used internally to insert element when creating nested subtrees. The only time it may be (and must be) omitted is when creating the root node.
 *
 * @property {string|HTMLElement} [cssStylesheetReferenceElement] - passed to cssInsert
 */

/** @typedef {object|string} FilterTreeStateObject
 *
 * @summary State with which to create a new node or replace an existing node.
 *
 * @desc A string or plain object that describes a filter-tree node. If a string, it is parsed into an object by {@link FilterNode~parseStateString}. (See, for available overloads.)
 *
 * The resulting object may be a flat object that describes a terminal node or a childless root or branch node; or may be a hierarchical object to define an entire tree or subtree.
 *
 * In any case, the resulting object may have any of the following properties:
 *
 * @property {menuItem[]} [schema] - See `schema` property of {@link FilterTreeOptionsObject}.
 *
 * @property {string} [editor='Default'] - See `editor` property of {@link FilterTreeOptionsObject}.
 *
 * @property misc - Other miscellaneous properties will be copied directly to the new `FitlerNode` object. (The name "misc" here is just a stand-in; there is no specific property called "misc".)
 *
 * * May describe a non-terminal node with properties:
 *   * `schema` - Overridden on instantiation by `options.schema`. If both unspecified, uses parent's definition.
 *   * `operator` - One of {@link treeOperators}.
 *   * `children` -  Array containing additional terminal and non-terminal nodes.
 *
 * The constructor auto-detects `state`'s type:
 *  * JSON string to be parsed by `JSON.parse()` into a plain object
 *  * SQL WHERE clause string to be parsed into a plain object
 *  * CSS selector of an Element whose `value` contains one of the above
 *  * plain object
 */

/**
 * @constructor
 *
 * @summary A node in a filter tree.
 *
 * @description A filter tree represents a _complex conditional expression_ and consists of a single instance of a {@link FilterTree} object as the _root_ of an _n_-ary tree.
 *
 * Filter trees are comprised of instances of `FilterNode` objects. However, the `FilterNode` constructor is an "abstract class"; filter node objects are never instantiated directly from this constructor. A filter tree is actually comprised of instances of two "subclasses" of `FilterNode` objects:
 * * {@link FilterTree} (or subclass thereof) objects, instances of which represent the root node and all the branch nodes:
 *   * There is always exactly one root node, containing the whole filter tree, which represents the filter expression in its entirety. The root node is distinguished by having no parent node.
 *   * There are zero or more branch nodes, or subtrees, which are child nodes of the root or other branches higher up in the tree, representing subexpressions within the larger filter expression. Each branch node has exactly one parent node.
 *   * These nodes point to zero or more child nodes which are either nested subtrees, or:
 * * {@link FilterLeaf} (or subclass thereof) objects, each instance of which represents a single simple conditional expression. These are terminal nodes, having exactly one parent node, and no child nodes.
 *
 * The programmer may extend the semantics of filter trees by extending the above objects.
 *
 * @property {sqlIdQtsObject} [sqlIdQts={beg:'"',end:'"'}] - Quote characters for SQL identifiers. Used for both parsing and generating SQL. Should be placed on the root node.
 *
 * @property {HTMLElement} el - The DOM element created by the `render` method to represent this node. Contains the `el`s for all child nodes (which are themselves pointed to by those nodes). This is always generated but is only in the page DOM if you put it there.
 */

var FilterNode = Base.extend('FilterNode', {

    /**
     * @summary Create a new node or subtree.
     * @desc Typically used by the application layer to create the entire filter tree; and internally, recursively, to create each node including both subtrees and leaves.
     *
     * **Node properties and options:** Nodes are instantiated with:
     * 1. Certain **required properties** which differ for subtrees and leaves.
     * 2. Arbitrary **non-standard option properties** are defined on the `options` object (so long as their names do not conflict with any standard options) and never persist.
     * 3. Certain **standard options properties** as defined in the {@link FilterNode~optionsSchema|optionsSchema} hash, come from various sources, as prioritized as follows:
     *    1. `options` object; does not persist
     *    2. `state`; object; persists
     *    3. `parent` object; persists
     *    4. `default` object; does not persist
     *
     * Notes:
     * 1. "Persists" means output by {@link FilterTree#getState|getState()}.
     * 2. The `parent` object is generated internally for subtrees. It allows standard options to inherit from the parent node.
     * 3. The `default` object comes from the `default` property, if any, of the {@link FilterNode~optionsSchema|schema object} for the standard option in question. Note that once defined, subtrees will then inherit this value.
     * 4. If not defined by any of the above, the standard option remains undefined on the node.
     *
     * **Query Builder UI support:** If your app wants to make use of the generated UI, you are responsible for inserting the top-level `.el` into the DOM. (Otherwise just ignore it.)
     *
     * @param {FilterTreeOptionsObject} [options] - The node state; or an options object possibly containing `state` among other options. Although you can instantiate a filter without any options, this is generally not useful. See *Instantiating a filter* in the {@link http://joneit.github.io/filter-tree/index.html|readme} for a practical discussion of minimum options.
     *
     * * @memberOf FilterNode#
     */
    initialize: function(options) {
        options = options || {};

        /** @summary Reference to this node's parent node.
         * @desc When this property is undefined, this node is the root node.
         * @type {FilterNode}
         * @memberOf FilterNode#
         */
        var parent = this.parent = this.parent || options.parent,
            root = parent && parent.root;

        if (!root) {
            root = this;

            this.stylesheet = this.stylesheet ||
                cssInjector(options.cssStylesheetReferenceElement);

            this.conditionals = new Conditionals(options); // .sqlIdQts

            this.ParserSQL = new ParserSQL(options); // .schema, .caseSensitiveColumnNames, .resolveAliases

            var keys = ['name'];
            if (options.resolveAliases) {
                keys.push('alias');
            }

            this.findOptions = {
                caseSensitive: options.caseSensitiveColumnNames,
                keys: keys
            };
        }

        /** @summary Convenience reference to the root node.
         * @name root
         * @type {FilterNode}
         * @memberOf FilterNode#
         */
        this.root = root;

        this.dontPersist = {}; // hash of truthy values

        this.setState(options.state, options);
    },

    /** Insert each subtree into its parent node along with a "delete" button.
     *
     * NOTE: The root tree (which has no parent) must be inserted into the DOM by the instantiating code (without a delete button).
     * @memberOf FilterNode#
     */
    render: function() {
        if (this.parent) {
            var newListItem = document.createElement(CHILD_TAG);

            if (this.notesEl) {
                newListItem.appendChild(this.notesEl);
            }

            if (!this.keep) {
                var el = this.templates.get('removeButton');
                el.addEventListener('click', this.remove.bind(this));
                newListItem.appendChild(el);
            }

            newListItem.appendChild(this.el);

            this.parent.el.querySelector(CHILDREN_TAG).appendChild(newListItem);
        }
    },

    /**
     *
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options]
     * @memberOf FilterNode#
     */
    setState: function(state, options) {
        var oldEl = this.el;

        state = this.parseStateString(state, options);

        this.mixInStandardOptions(state, options);
        this.mixInNonstandardOptions(options);
        this.createView(state);
        this.loadState(state);
        this.render();

        if (oldEl) {
            var newEl = this.el;
            if (this.parent && oldEl.parentElement.tagName === 'LI') {
                oldEl = oldEl.parentNode;
                newEl = newEl.parentNode;
            }
            oldEl.parentNode.replaceChild(newEl, oldEl);
        }
    },

    /**
     * @summary Convert a string to a state object.
     *
     * @desc They string's syntax is inferred as follows:
     * 1. If state is undefined or already an object, return as is.
     * 2. If `options.context` is defined, `state` is assumed to be a CSS selector string (auto-detected) pointing to an HTML form control with a `value` property, such as a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement HTMLInputElement} or a {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTextAreaElement HTMLTextAreaElement}. The element is selected and if found, its value is fetched from the DOM and assigned to `state`.
     * 3. If `options.syntax` is `'auto'`, JSON syntax is detected if `state` begins _and_ ends with either `[` and `]` _or_ `{` and `}` (ignoring leading and trailing white space).
     * 4. If JSON syntax, parse the string into an actual `FilterTreeStateObject` using {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse|JSON.parse} and throw an error if unparsable.
     * 5. If not JSON, parse the string as SQL into an actual `FilterTreeStateObject` using parser-SQL's {@link ParserSQL#parser|parser} and throw an error if unparsable.
     *
     * @param {FilterTreeStateObject} [state]
     * @param {FilterTreeSetStateOptionsObject} [options]
     *
     * @returns {FilterTreeStateObject} The unmolested `state` parameter. Throws an error if `state` is unknown or invalid syntax.
     *
     * @memberOf FilterNode#
     * @inner
     */
    parseStateString: function(state, options) {
        if (state) {
            if (typeof state === 'string') {
                var context = options && options.context,
                    syntax = options && options.syntax || 'auto'; // default is 'auto'

                if (context) {
                    state = context.querySelector(state).value;
                }

                if (syntax === 'auto') {
                    syntax = reJSON.test(state) ? 'JSON' : 'SQL';
                }

                switch (syntax) {
                    case 'JSON':
                        try {
                            state = JSON.parse(state);
                        } catch (error) {
                            throw new FilterTreeError('JSON parser: ' + error);
                        }
                        break;
                    case 'SQL':
                        try {
                            state = this.root.ParserSQL.parse(state);
                        } catch (error) {
                            throw new FilterTreeError('SQL WHERE clause parser: ' + error);
                        }
                        break;
                }
            }

            if (typeof state !== 'object') {
                throw new FilterTreeError('Unexpected input state.');
            }
        }

        return state;
    },

    /**
     * Create each standard option from when found on the `options` or `state` objects, respectively; or if not an "own" option, on the `parent` object or from the options schema default (if any)
     * @param state
     * @param options
     */
    mixInStandardOptions: function(state, options) {
        var node = this;

        _(FilterNode.optionsSchema).each(function(optionSchema, key) {
            if (!optionSchema.ignore && (this !== this.root || optionSchema.rootBound)) {
                var option;

                node.dontPersist[key] = // truthy if from `options` or `default`
                    (option = options && options[key]) !== undefined ||
                    (option = state && state[key]) === undefined &&
                    !(optionSchema.own || node.hasOwnProperty(key) && option !== null) &&
                    !(option = node.parent && node.parent[key]) &&
                    (option = optionSchema.default);

                if (option === null) {
                    delete node[key];
                    node.dontPersist[key] = false;
                } else if (option) {
                    if (key === 'schema' && !option.walk) {
                        // attach the `walk` and `find` convenience methods to the `schema` array
                        option.walk = popMenu.walk.bind(option);
                        option.lookup = popMenu.lookup.bind(option, node.root.findOptions);
                    }
                    node[key] = option;
                }
            }
        });
    },

    /**
     * @param options
     */
    mixInNonstandardOptions: function(options) {
        var node = this;

        // copy all remaining options directly to the new instance, overriding prototype members of the same name
        _(options).each(function(value, key) {
            if (!FilterNode.optionsSchema[key]) {
                node[key] = value;
            }
        });
    },

    /** Remove both:
     * * `this` filter node from it's `parent`'s `children` collection; and
     * * `this` filter node's `el`'s container (always a `<li>` element) from its parent element.
     * @memberOf FilterNode#
     */
    remove: function() {
        var avert,
            parent = this.parent;

        if (parent) {
            if (this.eventHandler) {
                this.eventHandler.call(parent, {
                    type: 'delete',
                    preventDefault: function() { avert = true; }
                });
            }
            if (!avert) {
                if (
                    parent.keep || // never "prune" (remove if empty) this particular subexpression
                    parent.children.length > 1 // this node has siblings so will not be empty after this remove
                ) {
                    // proceed with remove
                    this.el.parentNode.remove(); // the parent is always the containing <li> tag
                    parent.children.splice(parent.children.indexOf(this), 1);
                } else {
                    // recurse to prune entire subexpression because it's prune-able and would end up empty (childless)
                    parent.remove();
                }
            }
        }
    },

    /**
     * Work-around for `this.el.querySelector(':scope>' + selector)` because `:scope` not supported in IE11.
     * @param {string} selector
     */
    firstChildOfType: function(selector) {
        var el = this.el.querySelector(selector);
        if (el && el.parentElement !== this.el) {
            el = null;
        }
        return el;
    },

    Error: FilterTreeError,

    templates: new Templates()
});

/** @typedef optionsSchemaObject
 * @summary Standard option schema
 * @desc Standard options are automatically added to nodes. Data sources for standard options include `options`, `state`, `parent` and `default` (in that order). Describes standard options through various properties:
 * @property {boolean} [ignore] - Do not automatically add to nodes (processed elsewhere).
 * @property {boolean} [own] - Do not automatically add from `parent` or `default`.
 * @property {boolean} [rootBound] - Automatically add to root node only.
 * @property {*} [default] - This is the default data source when all other strategies fail.
 */

/**
 * @summary Defines the standard options available to a node.
 * @desc The following properties bear the same names as the node options they define.
 * @type {object}
 * @memberOf FilterNode
 */
FilterNode.optionsSchema = {

    state: { ignore: true },

    cssStylesheetReferenceElement: { ignore: true },

    /** @summary Default column schema for column drop-downs of direct descendant leaf nodes only.
     * @memberOf FilterNode#
     * @type {string[]}
     */
    ownSchema: { own: true },

    /** @summary Column schema for column drop-downs of all descendant nodes. Pertains to leaf nodes only.
     * @memberOf FilterNode#
     * @type {menuItem[]}
     */
    schema: {},

    /** @summary Filter editor for user interface.
     * @desc Name of filter editor used by this and all descendant nodes. Pertains to leaf nodes only.
     * @default 'Default'
     * @memberOf FilterNode#
     * @type {string}
     */
    editor: {},

    /** @summary Event handler for UI events.
     * @desc See *Events* in the {@link http://joneit.github.io/filter-tree/index.html|readme} for more information.
     * @memberOf FilterNode#
     * @type {function}
     */
    eventHandler: {},

    /** @summary Fields data type.
     * @memberOf FilterNode#
     * @type {string}
     */
    type: { own: true },

    /** @summary Undeleteable node.
     * @desc Truthy means don't render a delete button next to the filter editor for this node.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    keep: { own: true },

    /** @summary Override operator list at any node.
     * @desc The default is applied to the root node and any other node without an operator menu.
     * @default {@link Conditionals.defaultOpMenu}.
     * @memberOf FilterNode#
     * @type {menuItem[]}
     */
    opMenu: { default: Conditionals.defaultOpMenu },

    /** @summary Truthy considers op valid only if in menu.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    opMustBeInMenu: {},

    /** @summary Dictionary of operator menus for specific data types.
     * @memberOf FilterNode#
     * @type {object}
     * @desc A hash of type names. Each member thus defined contains a specific operator menu for all descendant leaf nodes that:
     * 1. do not have their own operator menu (`opMenu` property) of their own; and
     * 2. whose columns resolve to that type.
     *
     * The type is determined by (in priority order):
     * 1. the `type` property of the {@link FilterLeaf}; or
     * 2. the `type` property of the element in the nearest node (including the leaf node itself) that has a defined `ownSchema` or `schema` array property with an element having a matching column name.
     */
    typeOpMap: { rootBound: true },

    /** @summary Truthy will sort the column menus.
     * @memberOf FilterNode#
     * @type {boolean}
     */
    sortColumnMenu: {}
};

FilterNode.setWarningClass = function(el, value) {
    if (arguments.length < 2) {
        value = el.value;
    }
    el.classList[value ? 'remove' : 'add']('filter-tree-warning');
    return value;
};

FilterNode.clickIn = function(el) {
    if (el) {
        if (el.tagName === 'SELECT') {
            setTimeout(function() { el.dispatchEvent(new MouseEvent('mousedown')); }, 0);
        } else {
            el.focus();
        }
    }
};

module.exports = FilterNode;

},{"./Conditionals":12,"./Templates":16,"./parser-SQL":18,"./stylesheet":19,"extend-me":9,"object-iterators":21,"pop-menu":23}],15:[function(require,module,exports){
/* eslint-env browser */

// This is the main file, usable as is, such as by /test/index.js.

// For npm: require this file
// For CDN: gulpfile.js browserifies this file with sourcemap to /build/filter-tree.js and uglified without sourcemap to /build/filter-tree.min.js. The CDN is https://joneit.github.io/filter-tree.

'use strict';

var popMenu = require('pop-menu');
var unstrungify = require('unstrungify');

var _ = require('object-iterators');
var FilterNode = require('./FilterNode');
var FilterLeaf = require('./FilterLeaf');
var operators = require('./tree-operators');


var ordinal = 0;

/** @constructor
 * @summary An object that represents the root node or a branch node in a filter tree.
 * @desc A node representing a subexpression in the filter expression. May be thought of as a parenthesized subexpression in algebraic expression syntax. As discussed under {@link FilterNode}, a `FilterTree` instance's child nodes may be either:
 * * Other (nested) `FilterTree` (or subclass thereof) nodes representing subexpressions.
 * * {@link FilterLeaf} (or subclass thereof) terminal nodes representing conditional expressions.
 *
 * The `FilterTree` object also has methods, some of which operate on a specific subtree instance, and some of which recurse through all the subtree's child nodes and all their descendants, _etc._
 *
 * The recursive methods are interesting. They all work similarly, looping through the list of child nodes, recursing when the child node is a nested subtree (which will recurse further when it has its own nested subtrees); and calling the polymorphic method when the child node is a `FilterLeaf` object, which is a terminal node. Such polymorphic methods include `setState()`, `getState()`, `invalid()`, and `test()`.
 *
 * For example, calling `test(dataRow)` on the root tree recurses through any subtrees eventually calling `test(dataRow)` on each of its leaf nodes and concatenating the results together using the subtree's `operator`. The subtree's `test(dataRow)` call then returns the result to it's parent's `test()` call, _etc.,_ eventually bubbling up to the root node's `test(dataRow)` call, which returns the final result to the original caller. This result determines if the given data row passed through the entire filter expression successfully (`true`) and should be displayed, or was blocked somewhere (`false`) and should not be displayed.
 *
 * Note that in practice:
 * 1. `children` may be empty. This represents a an empty subexpression. Normally pointless, empty subexpressions could be pruned. Filter-tree allows them however as harmless placeholders.
 * 1. `operator` may be omitted in which case it defaults to AND.
 * 1. A `false` result from a child node will short-stop an AND operation; a `true` result will short-stop an OR or NOR operation.
 *
 * Additional notes:
 * 1. A `FilterTree` may consist of a single leaf, in which case the concatenation `operator` is not needed and may be left undefined. However, if a second child is added and the operator is still undefined, it will be set to the default (`'op-and'`).
 * 2. The order of the children is undefined as all operators are commutative. For the '`op-or`' operator, evaluation ceases on the first positive result and for efficiency, all simple conditional expressions will be evaluated before any complex subexpressions.
 * 3. A nested `FilterTree` is distinguished (duck-typed) from a leaf node by the presence of a `children` member.
 * 4. Nesting a `FilterTree` containing a single child is valid (albeit pointless).
 *
 * **See also the properties of the superclass:** {@link FilterNode}
 *
 * @property {string} [operator='op-and'] - The operator that concatentates the test results from all the node's `children` (child nodes). Must be one of:
 * * `'op-and'`
 * * `'op-or'`
 * * `'op-nor'`
 *
 * Note that there is only one `operator` per subexpression. If you need to mix operators, create a subordinate subexpression as one of the child nodes.
 *
 * @property {FilterNode[]} children - A list of descendants of this node. As noted, these may be other `FilterTree` (or subclass thereof) nodes; or may be terminal `FilterLeaf` (or subclass thereof) nodes. May be any length including 0 (none; empty).
 *
 * @property {boolean} [keep=false] - Do not automatically prune when last child removed.
 *
 * @property {fieldItem[]} [ownSchema] - Column menu to be used only by leaf nodes that are children (direct descendants) of this node.
 *
 * @property {string} [type='subtree'] - Type of node, for rendering purposes; names the rendering template to use to generate the node's UI representation.
 */
var FilterTree = FilterNode.extend('FilterTree', {

    /**
     * Hash of constructors for objects that extend from {@link FilterLeaf}, which is the `Default` member here.
     *
     * Add additional editors to this object (in the prototype) prior to instantiating a leaf node that refers to it. This object exists in the prototype and additions to it will affect all nodes that don't have their an "own" hash.
     *
     * If you create an "own" hash in your instance be sure to include the default editor, for example: `{ Default: FilterTree.prototype.editors.Default, ... }`. (One way of overriding would be to include such an object in an `editors` member of the options object passed to the constructor on instantiation. This works because all miscellaneous members are simply copied to the new instance. Not to be confused with the standard option `editor` which is a string containing a key from this hash and tells the leaf node what type to use.)
     */
    editors: {
        Default: FilterLeaf
    },

    /**
     * An extension is a hash of prototype overrides (methods, properties) used to extend the default editor.
     * @param {string} [key='Default'] - Nme of the new extension given in `ext` or name of an existing extension in `FilterTree.extensions`. As a constructor, should have an initial capital. If omitted, replaces the default editor (FilterLeaf).
     * @param {object} [ext] An extension hash
     * @param {FilerLeaf} [BaseEditor=this.editors.Default] - Constructor to extend from.
     * @returns {FillterLeaf} A new class extended from `BaseEditor` -- which is initially `FilterLeaf` but may itself have been extended by a call to `.addEditor('Default', extension)`.
     */
    addEditor: function(key, ext, BaseEditor) {
        if (typeof key === 'object') {
            // `key` (string) was omitted
            BaseEditor = ext;
            ext = key;
            key = 'Default';
        }
        BaseEditor = BaseEditor || this.editors.Default;
        ext = ext || FilterTree.extensions[key];
        return (this.editors[key] = BaseEditor.extend(key, ext));
    },

    /**
     * @param {string} key - The name of the existing editor to remove.
     * @memberOf FilterTree#
     */
    removeEditor: function(key) {
        if (key === 'Default') {
            throw 'Cannot remove default editor.';
        }
        delete this.editors[key];
    },

    /**
     *
     * @memberOf FilterTree#
     */
    createView: function() {
        this.el = this.templates.get(
            this.type || 'subtree',
            ++ordinal,
            this.schema[0] && popMenu.formatItem(this.schema[0])
        );

        // Add the expression editors to the "add new" drop-down
        var addNewCtrl = this.firstChildOfType('select');
        if (addNewCtrl) {
            var submenu, optgroup,
                editors = this.editors;

            if (addNewCtrl.length === 1 && this.editors.length === 1) {
                // this editor is the only option besides the null prompt option
                // so make it th eonly item i the drop-down
                submenu = addNewCtrl;
            } else {
                // there are already options and/or multiple editors
                submenu = optgroup = document.createElement('optgroup');
                optgroup.label = 'Conditional Expressions';
            }
            Object.keys(editors).forEach(function(key) {
                var name = editors[key].prototype.name || key;
                submenu.appendChild(new Option(name, key));
            });
            if (optgroup) {
                addNewCtrl.add(optgroup);
            }
            this.el.addEventListener('change', onchange.bind(this));
        }

        this.el.addEventListener('click', onTreeOpClick.bind(this));
    },

    /**
     *
     * @memberOf FilterTree#
     */
    loadState: function(state) {
        this.operator = 'op-and';
        this.children = [];

        if (!state) {
            this.add();
        } else {
            // Validate `state.children` (required)
            if (!(state.children instanceof Array)) {
                throw new this.Error('Expected `children` property to be an array.');
            }

            // Validate `state.operator` (if given)
            if (state.operator) {
                if (!operators[state.operator]) {
                    throw new this.Error('Expected `operator` property to be one of: ' + Object.keys(operators));
                }

                this.operator = state.operator;
            }

            state.children.forEach(this.add.bind(this));
        }
    },

    /**
     *
     * @memberOf FilterTree#
     */
    render: function() {
        var radioButton = this.firstChildOfType('label > input[value=' + this.operator + ']'),
            addFilterLink = this.el.querySelector('.filter-tree-add-conditional');

        if (radioButton) {
            radioButton.checked = true;
            onTreeOpClick.call(this, {
                target: radioButton
            });
        }

        // when multiple filter editors available, simulate click on the new "add conditional" link
        if (addFilterLink && !this.children.length && Object.keys(this.editors).length > 1) {
            this['filter-tree-add-conditional']({
                target: addFilterLink
            });
        }

        // proceed with render
        FilterNode.prototype.render.call(this);
    },

    /**
     * @summary Create a new node as per `state`.
     *
     * @param {object} [options={state:{}}] - May be one of:
     *
     * * an `options` object containing a `state` property
     * * a `state` object (in which case there is no `options` object)
     *
     * In any case, resulting `state` object may be either...
     * * A new subtree (has a `children` property):
     *   Add a new `FilterTree` node.
     * * A new leaf (no `children` property): add a new `FilterLeaf` node:
     *   * If there is an `editor` property:
     *     Add leaf using `this.editors[state.editor]`.
     *   * Otherwise (including the case where `state` is undefined):
     *     Add leaf using `this.editors.Default`.
     *
     * @param {boolean} [options.focus=false] Call invalid() after inserting to focus on first blank control (if any).
     *
     * @returns {FilterNode} The new node.
     *
     * @memberOf FilterTree#
     */
    add: function(options) {
        var Constructor, newNode;

        options = options || {};

        if (!options.state) {
            options = { state: options };
        }

        if (options.state.children) {
            Constructor = this.constructor;
        } else {
            Constructor = this.editors[options.state.editor || 'Default'];
        }

        options.parent = this;
        newNode = new Constructor(options);
        this.children.push(newNode);

        if (options.focus) {
            // focus on blank control a beat after adding it
            setTimeout(function() { newNode.invalid(options); }, 750);
        }

        return newNode;
    },

    /** @typedef {object} FilterTreeValidationOptionsObject
     * @property {boolean} [throw=false] - Throw (do not catch) `FilterTreeError`s.
     * @property {boolean} [alert=false] - Announce error via window.alert() before returning.
     * @property {boolean} [focus=false] - Place the focus on the offending control and give it error color.
     */

    /**
     * @param {FilterTreeValidationOptionsObject} [options]
     * @returns {undefined|FilterTreeError} `undefined` if valid; or the caught `FilterTreeError` if error.
     * @memberOf FilterTree#
     */
    invalid: function(options) {
        options = options || {};

        var result, throwWas;

        throwWas = options.throw;
        options.throw = true;

        try {
            invalid.call(this, options);
        } catch (err) {
            result = err;

            // Throw when unexpected (not a filter tree error)
            if (!(err instanceof this.Error)) {
                throw err;
            }
        }

        options.throw = throwWas;

        // Alter and/or throw when requested
        if (result) {
            if (options.alert) {
                window.alert(result.message || result); // eslint-disable-line no-alert
            }
            if (options.throw) {
                throw result;
            }
        }

        return result;
    },

    /**
     *
     * @param dataRow
     * @returns {boolean}
     * @memberOf FilterTree#
     */
    test: function test(dataRow) {
        var operator = operators[this.operator],
            result = operator.seed,
            noChildrenDefined = true;

        this.children.find(function(child) {
            if (child) {
                noChildrenDefined = false;
                if (child instanceof FilterLeaf) {
                    result = operator.reduce(result, child.test(dataRow));
                } else if (child.children.length) {
                    result = operator.reduce(result, test.call(child, dataRow));
                }
                return result === operator.abort;
            }

            return false;
        });

        return noChildrenDefined || (operator.negate ? !result : result);
    },

    /**
     * @returns {number} Number of filters (terminal nodes) defined in this subtree.
     */
    filterCount: function filterCount() {
        var n = 0;

        this.children.forEach(function(child) {
            n += child instanceof FilterLeaf ? 1 : filterCount.call(child);
        });

        return n;
    },

    /** @typedef {object} FilterTreeGetStateOptionsObject
     *
     * @summary Object containing options for producing a state object.
     *
     * @desc State is commonly used for two purposes:
     * 1. To persist the filter state so that it can be reloaded later.
     * 2. To send a query to a database engine.
     *
     * @property {boolean} [syntax='object'] - A case-sensitive string indicating the expected type and format of a state object to be generated from a filter tree. One of:
     * * `'object'` (default) A raw state object produced by walking the tree using `{@link https://www.npmjs.com/package/unstrungify|unstrungify()}`, respecting `JSON.stringify()`'s "{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior|toJSON() behavior}," and returning a plain object suitable for resubmitting to {@link FilterNode#setState|setState}. This is an "essential" version of the actual node objects in the tree.
     * * `'JSON'` - A stringified state object produced by walking the tree using `{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON()_behavior|JSON.stringify()}`, returning a JSON string by calling `toJSON` at every node. This is a string representation of the same "essential" object as that produced by the `'object'` option, but "stringified" and therefore suitable for text-based storage media.
     * * `'SQL'` - The subexpression in SQL conditional syntax produced by walking the tree and returning a SQL [search condition expression]{@link https://msdn.microsoft.com/en-us/library/ms173545.aspx}. Suitable for use in the WHERE clause of a SQL `SELECT` statement used to query a database for a filtered result set.
     *
     * @param {number|string} [space] - When `options.syntax === 'JSON'`, forwarded to `JSON.stringify` as the third parameter, `space` (see).
     *
     * NOTE: The SQL syntax result cannot accommodate node meta-data. While meta-data such as `type` typically comes from the column schema, meta-data can be installed directly on a node. Such meta-data will not be part of the resulting SQL expression. For this reason, SQL should not be used to persist filter state but rather its use should be limited to generating a filter query for a remote data server.
     */

    /**
     * @summary Get a representation of filter state.
     * @desc Calling this on the root will get the entire tree's state; calling this on any subtree will get just that subtree's state.
     *
     * Only _essential_ properties will be output:
     *
     * 1. `FilterTree` nodes will output at least 2 properties:
     *    * `operator`
     *    * `children`
     * 2. `FilterLeaf` nodes will output (via {@link FilterLeaf#getState|getState}) at least 3 properties, one property for each item in it's `view`:
     *    * `column`
     *    * `operator`
     *    * `operand`
     * 3. Additional node properties will be output when:
     *    1. When the property was **NOT** externally sourced:
     *       1. Did *not* come from the `options` object on node instantiation.
     *       2. Did *not* come from the options schema `default` object, if any.
     *    2. **AND** at least one of the following is true:
     *       1. When it's an "own" property.
     *       2. When its value differs from it's parent's.
     *       3. When this is the root node.
     *
     * @param {FilterTreeGetStateOptionsObject} [options]
     * @param {object} [options.sqlIdQts] - When `options.syntax === 'SQL'`, forwarded to `conditionals.pushSqlIdQts()`.
     * @returns {object|string} Returns object when `options.syntax === 'object'`; otherwise returns string.
     * @memberOf FilterTree#
     */
    getState: function getState(options) {
        var result = '',
            syntax = options && options.syntax || 'object';

        switch (syntax) {
            case 'object':
                result = unstrungify.call(this);
                break;

            case 'JSON':
                result = JSON.stringify(this, null, options && options.space) || '';
                break;

            case 'SQL':
                var lexeme = operators[this.operator].SQL;

                this.children.forEach(function(child, idx) {
                    var op = idx ? ' ' + lexeme.op + ' ' : '';
                    if (child instanceof FilterLeaf) {
                        result += op + child.getState(options);
                    } else if (child.children.length) {
                        result += op + getState.call(child, options);
                    }
                });

                if (result) {
                    result = lexeme.beg + result + lexeme.end;
                }
                break;

            default:
                throw new this.Error('Unknown syntax option "' + syntax + '"');
        }

        return result;
    },

    toJSON: function toJSON() {
        var self = this,
            state = {
                operator: this.operator,
                children: []
            };

        this.children.forEach(function(child) {
            state.children.push(child instanceof FilterLeaf ? child : toJSON.call(child));
        });

        _(FilterNode.optionsSchema).each(function(optionSchema, key) {
            if (
                self[key] && // there is a standard option on the node which may need to be output
                !self.dontPersist[key] && (
                    optionSchema.own || // output because it's an "own" option (belongs to the node)
                    !self.parent || // output because it's the root node
                    self[key] !== self.parent[key] // output because it differs from its parent's version
                )
            ) {
                state[key] = self[key];
            }
        });

        return state;
    },

    /**
     * @summary Set the case sensitivity of filter tests against data.
     * @desc Case sensitivity pertains to string compares only. This includes untyped columns, columns typed as strings, typed columns containing data that cannot be coerced to type or when the filter expression operand cannot be coerced.
     *
     * NOTE: This is a shared property and affects all filter-tree instances constructed by this code instance.
     * @param {boolean} isSensitive
     * @memberOf Filtertree#.prototype
     */
    set caseSensitiveData(isSensitive) {
        var toString = isSensitive ? toStringCaseSensitive : toStringCaseInsensitive;
        FilterLeaf.setToString(toString);
    }

});

function toStringCaseInsensitive(s) { return (s + '').toUpperCase(); }
function toStringCaseSensitive(s) { return s + ''; }

// Some event handlers bound to FilterTree object

function onchange(evt) { // called in context
    var ctrl = evt.target;
    if (ctrl.parentElement === this.el) {
        if (ctrl.value === 'subexp') {
            this.children.push(new FilterTree({
                parent: this
            }));
        } else {
            this.add({
                state: { editor: ctrl.value },
                focus: true
            });
        }
        ctrl.selectedIndex = 0;
    }
}

function onTreeOpClick(evt) { // called in context
    var ctrl = evt.target;

    if (ctrl.className === 'filter-tree-op-choice') {
        this.operator = ctrl.value;

        // display strike-through
        var radioButtons = this.el.querySelectorAll('label>input.filter-tree-op-choice[name=' + ctrl.name + ']');
        Array.prototype.forEach.call(radioButtons, function(ctrl) {
            ctrl.parentElement.style.textDecoration = ctrl.checked ? 'none' : 'line-through';
        });

        // display operator between filters by adding operator string as a CSS class of this tree
        for (var key in operators) {
            this.el.classList.remove(key);
        }
        this.el.classList.add(this.operator);
    }
}

/**
 * Throws error if invalid expression tree.
 * Caught by {@link FilterTree#invalid|FilterTree.prototype.invalid()}.
 * @param {boolean} [options.focus=false] - Move focus to offending control.
 * @returns {undefined} if valid
 * @private
 */
function invalid(options) { // called in context
    //if (this instanceof FilterTree && !this.children.length) {
    //    throw new this.Error('Empty subexpression (no filters).');
    //}

    this.children.forEach(function(child) {
        if (child instanceof FilterLeaf) {
            child.invalid(options);
        } else if (child.children.length) {
            invalid.call(child, options);
        }
    });
}

FilterTree.extensions = {
    Columns: require('./extensions/columns')
};

// module initialization
FilterTree.prototype.caseSensitiveData = true;  // default is case-sensitive which is more efficient; may be reset at will


module.exports = FilterTree;

},{"./FilterLeaf":13,"./FilterNode":14,"./extensions/columns":17,"./tree-operators":20,"object-iterators":21,"pop-menu":23,"unstrungify":26}],16:[function(require,module,exports){
/* eslint-env browser */

'use strict';

var templex = require('templex');

var templates = require('../html');

var encoders = /\{(\d+)\:encode\}/g;

function Templates() {}
var constructor = Templates.prototype.constructor;
Templates.prototype = templates;
Templates.prototype.constructor = constructor; // restore it
Templates.prototype.get = function(templateName) { // mix it in
    var keys,
        matches = {},
        temp = document.createElement('div'),
        text = this[templateName],
        args = Array.prototype.slice.call(arguments, 1);

    encoders.lastIndex = 0;

    while ((keys = encoders.exec(text))) {
        matches[keys[1]] = true;
    }

    keys = Object.keys(matches);

    if (keys.length) {
        keys.forEach(function(key) {
            temp.textContent = args[key];
            args[key] = temp.innerHTML;
        });
        text = text.replace(encoders, '{$1}');
    }

    temp.innerHTML = templex.apply(this, [text].concat(args));

    // if only one HTMLElement, return it; otherwise entire list of nodes
    return temp.children.length === 1 && temp.childNodes.length === 1
        ? temp.firstChild
        : temp.childNodes;
};

module.exports = Templates;

},{"../html":10,"templex":25}],17:[function(require,module,exports){
'use strict';

var Conditionals = require('../Conditionals');
var FilterLeaf = require('../FilterLeaf');

/**
 * @summary Prototype additions object for extending {@link FilterLeaf}.
 * @desc Resulting object is similar to {@link FilterLeaf} except:
 * 1. The `operand` property names another column rather than contains a literal.
 * 2. Operators are limited to equality, inequalities, and sets (IN/NOT IN). Omitted are the string and pattern scans (BEGINS/NOT BEGINS, ENDS/NOT ENDS, CONTAINS/NOT CONTAINS, and LIKE/NOT LIKE).
 *
 * @extends FilterLeaf
 *
 * @property {string} identifier - Name of column (member of data row object) to compare against this column (member of data row object named by `column`).
 */
var ColumnLeaf = {
    name: 'column = column', // display string for drop-down

    createView: function() {
        // Create the `view` hash and insert the three default elements (`column`, `operator`, `operand`) into `.el`
        FilterLeaf.prototype.createView.call(this);

        // Replace the `operand` element from the `view` hash
        var oldOperand = this.view.operand,
            newOperand = this.view.operand = this.makeElement(this.root.schema, 'column', this.sortColumnMenu);

        // Replace the operand element with the new one. There are no event listeners to worry about.
        this.el.replaceChild(newOperand, oldOperand);
    },

    makeSqlOperand: function() {
        return this.root.conditionals.makeSqlIdentifier(this.operand);
    },

    opMenu: [
        Conditionals.groups.equality,
        Conditionals.groups.inequalities,
        Conditionals.groups.sets
    ],

    q: function(dataRow) {
        return this.valOrFunc.call(dataRow, this.operand);
    }
};

module.exports = ColumnLeaf;

},{"../Conditionals":12,"../FilterLeaf":13}],18:[function(require,module,exports){
'use strict';

var reOp = /^((=|>=?|<[>=]?)|(NOT )?(LIKE|IN)\b)/i, // match[1]
    reFloat = /^([+-]?(\d+(\.\d*)?|\d*\.\d+)(e[+-]\d+)?)[^\d]?/i,
    reLit = /^'(\d+)'/,
    reLitAnywhere = /'(\d+)'/,
    reIn = /^\((.*?)\)/,
    reBool = /^(AND|OR)\b/i,
    reGroup = /^(NOT ?)?\(/i;

var SQT = '\'';

var defaultIdQts = {
    beg: '"',
    end: '"'
};

function ParserSqlError(message) {
    this.message = message;
}
ParserSqlError.prototype = Object.create(Error.prototype);
ParserSqlError.prototype.name = 'ParserSqlError';

/** @typedef {object} sqlIdQtsObject
 * @desc On a practical level, the useful characters are:
 * * SQL-92 standard: "double quotes"
 * * SQL Server: "double quotes" or \[square brackets\]
 * * mySQL: \`tick marks\`
 * @property {string} beg - The open quote character.
 * @property {string} end - The close quote character.
 */

/**
 * @constructor
 * @summary Structured Query Language (SQL) parser
 * @author Jonathan Eiten <jonathan@openfin.com>
 * @desc This is a subset of SQL conditional expression syntax.
 *
 * @see {@link https://msdn.microsoft.com/en-us/library/ms173545.aspx SQL Search Condition}
 *
 * @param {menuItem[]} [options.schema] - Column schema for column name validation. Throws an error if name fails validation (but see `resolveAliases`). Omit to skip column name validation.
 * @param {boolean} [options.resolveAliases] - Validate column aliases against schema and use the associated column name in the returned expression state object. Requires `options.schema`. Throws error if no such column found.
 * @param {boolean} [options.caseSensitiveColumnNames] - Ignore case while validating column names and aliases.
 * @param {sqlIdQtsObject} [options.sqlIdQts={beg:'"',end:'"'}]
 */
function ParserSQL(options) {
    options = options || {};

    this.schema = options.schema;

    var idQts = options.sqlIdQts || defaultIdQts;
    this.reName = new RegExp('^(' + idQts.beg + '(.+?)' + idQts.end + '|([A-Z_][A-Z_@\\$#]*)\\b)', 'i'); // match[2] || match[3]
}

ParserSQL.prototype = {

    constructor: ParserSQL.prototype.constructor,

    /**
     * @param {string} sql
     * @returns {*}
     * @memberOf module:sqlSearchCondition
     */
    parse: function(sql) {
        var state;

        // reduce all runs of white space to a single space; then trim
        sql = sql.replace(/\s\s+/g, ' ').trim();

        sql = stripLiterals.call(this, sql);
        state = walk.call(this, sql);

        if (!state.children) {
            state = { children: [ state ] };
        }

        return state;
    }
};

function walk(t) {
    var m, name, op, operand, editor, bool, token, tokens = [];
    var i = 0;

    t = t.trim();

    while (i < t.length) {
        m = t.substr(i).match(reGroup);
        if (m) {
            var not = !!m[1];

            i += m[0].length;
            for (var j = i, v = 1; j < t.length && v; ++j) {
                if (t[j] === '(') {
                    ++v;
                } else if (t[j] === ')') {
                    --v;
                }
            }

            if (v) {
                throw new ParserSqlError('Expected ")"');
            }
            token = walk.call(this, t.substr(i, j - 1 - i));
            if (typeof token !== 'object') {
                return token;
            }

            if (not) {
                if (token.operator !== 'op-or') {
                    throw new ParserSqlError('Expected OR in NOT(...) subexpression but found ' + token.operator.substr(3).toUpperCase() + '.');
                }
                token.operator = 'op-nor';
            }

            i = j;
        } else {

            // column:

            m = t.substr(i).match(this.reName);
            if (!m) {
                throw new ParserSqlError('Expected identifier or quoted identifier.');
            }
            name = m[2] || m[3];
            if (!/^[A-Z_]/i.test(t[i])) { i += 2; }
            i += name.length;

            // operator:

            if (t[i] === ' ') { ++i; }
            m = t.substr(i).match(reOp);
            if (!m) {
                throw new ParserSqlError('Expected relational operator.');
            }
            op = m[1].toUpperCase();
            i += op.length;

            // operand:

            editor = undefined;
            if (t[i] === ' ') { ++i; }
            if (m[4] && m[4].toUpperCase() === 'IN') {
                m = t.substr(i).match(reIn);
                if (!m) {
                    throw new ParserSqlError('Expected parenthesized list.');
                }
                operand = m[1];
                i += operand.length + 2;
                while ((m = operand.match(reLitAnywhere))) {
                    operand = operand.replace(reLitAnywhere, this.literals[m[1]]);
                }
            } else if ((m = t.substr(i).match(reLit))) {
                operand = m[1];
                i += operand.length + 2;
                operand = this.literals[operand];
            } else if ((m = t.substr(i).match(reFloat))) {
                operand = m[1];
                i += operand.length;
            } else if ((m = t.substr(i).match(this.reName))) {
                operand = m[2] || m[3];
                i += operand.length;
                editor = 'Columns';
            } else {
                throw new ParserSqlError('Expected number or string literal or column.');
            }

            if (this.schema) {
                name = lookup.call(this, name);

                if (editor) {
                    operand = lookup.call(this, operand);
                }
            }

            token = {
                column: name,
                operator: op,
                operand: operand
            };

            if (editor) {
                token.editor = editor;
            }
        }

        tokens.push(token);

        if (i < t.length) {
            if (t[i] === ' ') { ++i; }
            m = t.substr(i).match(reBool);
            if (!m) {
                throw new ParserSqlError('Expected boolean operator.');
            }
            bool = m[1].toLowerCase();
            i += bool.length;
            bool = 'op-' + bool;
            if (tokens.operator && tokens.operator !== bool) {
                throw new ParserSqlError('Expected same boolean operator throughout subexpression.');
            }
            tokens.operator = bool;
        }

        if (t[i] === ' ') { ++i; }
    }

    return (
        tokens.length === 1 ? tokens[0] : {
            operator: tokens.operator,
            children: tokens
        }
    );
}

function lookup(name) {
    var item = this.schema.lookup(name);

    if (!item) {
        throw new ParserSqlError(this.resolveAliases
            ? 'Expected valid column name.'
            : 'Expected valid column name or alias.'
        );
    }

    return item.name;
}

function stripLiterals(t) {
    var i = 0, j = 0, k;

    this.literals = [];

    while ((j = t.indexOf(SQT, j)) >= 0) {
        k = j;
        do {
            k = t.indexOf(SQT, k + 1);
            if (k < 0) {
                throw new ParserSqlError('Expected ' + SQT + ' (single quote).');
            }
        } while (t[++k] === SQT);
        this.literals.push(t.slice(++j, --k).replace(/''/g, SQT));
        t = t.substr(0, j) + i + t.substr(k);
        j = j + 1 + (i + '').length + 1;
        i++;
    }

    return t;
}

module.exports = ParserSQL;

},{}],19:[function(require,module,exports){
'use strict';

var cssInjector = require('css-injector');

var css; // defined by code inserted by gulpfile between following comments
/* inject:css */
css = '.filter-tree{font-family:sans-serif;font-size:10pt;line-height:1.5em}.filter-tree label{font-weight:400}.filter-tree input[type=checkbox],.filter-tree input[type=radio]{margin-left:3px;margin-right:3px}.filter-tree ol{margin-top:0}.filter-tree>select{float:right;border:1px dotted grey;background-color:transparent;box-shadow:none}.filter-tree-remove-button{display:inline-block;width:15px;height:15px;border-radius:8px;background-color:#e88;font-size:11.5px;color:#fff;text-align:center;line-height:normal;font-style:normal;font-family:sans-serif;margin-right:4px;cursor:pointer}.filter-tree-remove-button:hover{background-color:transparent;color:#e88;font-weight:700;box-shadow:red 0 0 2px inset}.filter-tree-remove-button::before{content:\'\\d7\'}.filter-tree li::after{font-size:70%;font-style:italic;font-weight:700;color:#080}.filter-tree>ol>li:last-child::after{display:none}.op-and>ol,.op-nor>ol,.op-or>ol{padding-left:5px;margin-left:27px}.op-or>ol>li::after{margin-left:2.5em;content:\'— OR —\'}.op-and>ol>li::after{margin-left:2.5em;content:\'— AND —\'}.op-nor>ol>li::after{margin-left:2.5em;content:\'— NOR —\'}.filter-tree-editor>*{font-weight:700}.filter-tree-editor>span{font-size:smaller}.filter-tree-editor>input[type=text]{width:8em;padding:1px 5px 2px}.filter-tree-warning{background-color:#ffc!important;border-color:#edb!important;font-weight:400!important}.filter-tree-error{background-color:#fcc!important;border-color:#c99!important;font-weight:400!important}.filter-tree-default>:enabled{margin:0 .4em;background-color:#ddd;border:1px solid transparent}.filter-tree.filter-tree-type-column-filters>ol>li:not(:last-child){padding-bottom:.75em;border-bottom:3px double #080;margin-bottom:.75em}.filter-tree .footnotes{margin:0 0 6px;font-size:8pt;font-weight:400;line-height:normal;white-space:normal;color:#c00}.filter-tree .footnotes>p{margin:0}.filter-tree .footnotes>ul{margin:-3px 0 0;padding-left:17px;text-index:-6px}.filter-tree .footnotes>ul>li{margin:2px 0}.filter-tree .footnotes .field-name,.filter-tree .footnotes .field-value{font-weight:700;font-style:normal}.filter-tree .footnotes .field-value{font-family:monospace;color:#000;background-color:#ddd;padding:0 5px;margin:0 3px;border-radius:3px}';
/* endinject */

module.exports = cssInjector.bind(this, css, 'filter-tree-base');

},{"css-injector":8}],20:[function(require,module,exports){
'use strict';

/** @typedef {function} operationReducer
 * @param {boolean} p
 * @param {boolean} q
 * @returns {boolean} The result of applying the operator to the two parameters.
 */

/**
 * @private
 * @type {operationReducer}
 */
function AND(p, q) {
    return p && q;
}

/**
 * @private
 * @type {operationReducer}
 */
function OR(p, q) {
    return p || q;
}

/** @typedef {obejct} treeOperator
 * @desc Each `treeOperator` object describes two things:
 *
 * 1. How to take the test results of _n_ child nodes by applying the operator to all the results to "reduce" it down to a single result.
 * 2. How to generate SQL WHERE clause syntax that applies the operator to _n_ child nodes.
 *
 * @property {operationReducer} reduce
 * @property {boolean} seed -
 * @property {boolean} abort -
 * @property {boolean} negate -
 * @property {string} SQL.op -
 * @property {string} SQL.beg -
 * @property {string} SQL.end -
 */

/** A hash of {@link treeOperator} objects.
 * @type {object}
 */
var treeOperators = {
    'op-and': {
        reduce: AND,
        seed: true,
        abort: false,
        negate: false,
        SQL: {
            op: 'AND',
            beg: '(',
            end: ')'
        }
    },
    'op-or': {
        reduce: OR,
        seed: false,
        abort: true,
        negate: false,
        SQL: {
            op: 'OR',
            beg: '(',
            end: ')'
        }
    },
    'op-nor': {
        reduce: OR,
        seed: false,
        abort: true,
        negate: true,
        SQL: {
            op: 'OR',
            beg: 'NOT (',
            end: ')'
        }
    }
};

module.exports = treeOperators;

},{}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
'use strict';

var // a regex search pattern that matches all the reserved chars of a regex search pattern
    reserved = /([\.\\\+\*\?\^\$\(\)\{\}\=\!\<\>\|\:\[\]])/g,

    // regex wildcard search patterns
    REGEXP_WILDCARD = '.*',
    REGEXP_WILDCHAR = '.',
    REGEXP_WILDCARD_MATCHER = '(' + REGEXP_WILDCARD + ')',

    // LIKE search patterns
    LIKE_WILDCHAR = '_',
    LIKE_WILDCARD = '%',

    // regex search patterns that match LIKE search patterns
    REGEXP_LIKE_PATTERN_MATCHER = new RegExp('(' + [
        LIKE_WILDCHAR,
        LIKE_WILDCARD,
        '\\[\\^?[^-\\]]+]', // matches a LIKE set (same syntax as a RegExp set)
        '\\[\\^?[^-\\]]\\-[^\\]]]' // matches a LIKE range (same syntax as a RegExp range)
    ].join('|') + ')', 'g');

function regExpLIKE(pattern, ignoreCase) {
    var i, parts;

    // Find all LIKE patterns
    parts = pattern.match(REGEXP_LIKE_PATTERN_MATCHER);

    if (parts) {
        // Translate found LIKE patterns to regex patterns, escaped intervening non-patterns, and interleave the two

        for (i = 0; i < parts.length; ++i) {
            // Escape left brackets (unpaired right brackets are OK)
            if (parts[i][0] === '[') {
                parts[i] = regExpLIKE.reserve(parts[i]);
            }

            // Make each found pattern matchable by enclosing in parentheses
            parts[i] = '(' + parts[i] + ')';
        }

        // Match these precise patterns again with their intervening non-patterns (i.e., text)
        parts = pattern.match(new RegExp(
            REGEXP_WILDCARD_MATCHER +
            parts.join(REGEXP_WILDCARD_MATCHER)  +
            REGEXP_WILDCARD_MATCHER
        ));

        // Discard first match of non-global search (which is the whole string)
        parts.shift();

        // For each re-found pattern part, translate % and _ to regex equivalent
        for (i = 1; i < parts.length; i += 2) {
            var part = parts[i];
            switch (part) {
                case LIKE_WILDCARD: part = REGEXP_WILDCARD; break;
                case LIKE_WILDCHAR: part = REGEXP_WILDCHAR; break;
                default:
                    var j = part[1] === '^' ? 2 : 1;
                    part = '[' + regExpLIKE.reserve(part.substr(j, part.length - (j + 1))) + ']';
            }
            parts[i] = part;
        }
    } else {
        parts = [pattern];
    }

    // For each surrounding text part, escape reserved regex chars
    for (i = 0; i < parts.length; i += 2) {
        parts[i] = regExpLIKE.reserve(parts[i]);
    }

    // Join all the interleaved parts
    parts = parts.join('');

    // Optimize or anchor the pattern at each end as needed
    if (parts.substr(0, 2) === REGEXP_WILDCARD) { parts = parts.substr(2); } else { parts = '^' + parts; }
    if (parts.substr(-2, 2) === REGEXP_WILDCARD) { parts = parts.substr(0, parts.length - 2); } else { parts += '$'; }

    // Return the new regex
    return new RegExp(parts, ignoreCase ? 'i' : undefined);
}

regExpLIKE.reserve = function (s) {
    return s.replace(reserved, '\\$1');
};

var cache, size;

/**
 * @summary Delete a pattern from the cache; or clear the whole cache.
 * @param {string} [pattern] - The LIKE pattern to remove from the cache. Fails silently if not found in the cache. If pattern omitted, clears whole cache.
 */
(regExpLIKE.clearCache = function (pattern) {
    if (!pattern) {
        cache = {};
        size = 0;
    } else if (cache[pattern]) {
        delete cache[pattern];
        size--;
    }
    return size;
})(); // init the cache

regExpLIKE.getCacheSize = function () { return size; };

/**
 * @summary Cached version of `regExpLIKE()`.
 * @desc Cached entries are subject to garbage collection if `keep` is `undefined` or `false` on insertion or `false` on most recent reference. Garbage collection will occur iff `regExpLIKE.cacheMax` is defined and it equals the number of cached patterns. The garbage collector sorts the patterns based on most recent reference; the oldest 10% of the entries are deleted. Alternatively, you can manage the cache yourself to a limited extent (see {@link regeExpLIKE.clearCache|clearCache}).
 * @param pattern - the LIKE pattern (to be) converted to a RegExp
 * @param [keep] - If given, changes the keep status for this pattern as follows:
 * * `true` permanently caches the pattern (not subject to garbage collection) until `false` is given on a subsequent call
 * * `false` allows garbage collection on the cached pattern
 * * `undefined` no change to keep status
 * @returns {RegExp}
 */
regExpLIKE.cached = function (keep, pattern, ignoreCase) {
    if (typeof keep === 'string') {
        ignoreCase = pattern;
        pattern = keep;
        keep = false;
    }
    var patternAndCase = pattern + (ignoreCase ? 'i' : 'c'),
        item = cache[patternAndCase];
    if (item) {
        item.when = new Date().getTime();
        if (keep !== undefined) {
            item.keep = keep;
        }
    } else {
        if (size === regExpLIKE.cacheMax) {
            var age = [], ages = 0, key, i;
            for (key in cache) {
                item = cache[key];
                if (!item.keep) {
                    for (i = 0; i < ages; ++i) {
                        if (item.when < age[i].item.when) {
                            break;
                        }
                    }
                    age.splice(i, 0, { key: key, item: item });
                    ages++;
                }
            }
            if (!age.length) {
                return regExpLIKE(pattern, ignoreCase); // cache is full!
            }
            i = Math.ceil(age.length / 10); // will always be at least 1
            size -= i;
            while (i--) {
                delete cache[age[i].key];
            }
        }
        item = cache[patternAndCase] = {
            regex: regExpLIKE(pattern, ignoreCase),
            keep: keep,
            when: new Date().getTime()
        };
        size++;
    }
    return item.regex;
};

module.exports = regExpLIKE;

},{}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
// Created by Jonathan Eiten on 1/7/16.

'use strict';

/**
 * Very fast array test.
 * For cross-frame scripting; use `crossFramesIsArray` instead.
 * @param {*} arr - The object to test.
 * @returns {boolean}
 */
unstrungify.isArray = function(arr) { return arr.constructor === Array; };

/**
 * @summary Walk a hierarchical object as JSON.stringify does but without serializing.
 *
 * @desc Usage:
 * * var myDistilledObject = unstrungify.call(myObject);
 * * var myDistilledObject = myApi.getState(); // where myApi.prototype.getState = unstrungify
 *
 * Result equivalent to `JSON.parse(JSON.stringify(this))`.
 *
 * > Do not use this function to get a JSON string; use `JSON.stringify(this)` instead.
 *
 * @this {*|object|*[]} - Object to walk; typically an object or array.
 *
 * @param {boolean} [options.nullElements==false] - Preserve undefined array elements as `null`s.
 * Use this when precise index matters (not merely the order of the elements).
 *
 * @param {boolean} [options.nullProperties==false] - Preserve undefined object properties as `null`s.
 *
 * @returns {object} - Distilled object.
 */
function unstrungify(options) {
    var clone, preserve,
        object = (typeof this.toJSON === 'function') ? this.toJSON() : this;

    if (unstrungify.isArray(object)) {
        clone = [];
        preserve = options && options.nullElements;
        object.forEach(function(obj) {
            var value = unstrungify.call(obj);
            if (value !== undefined) {
                clone.push(value);
            } else if (preserve) {
                clone.push(null); // undefined not a valid JSON value
            }
        });
    } else  if (typeof object === 'object') {
        clone = {};
        preserve = options && options.nullProperties;
        Object.keys(object).forEach(function(key) {
            var value = object[key];
            if (value !== undefined) {
                value = unstrungify.call(object[key]);
            }
            if (value !== undefined) {
                clone[key] = value;
            } else if (preserve) {
                clone[key] = null; // undefined not a valid JSON value
            }
        });
    } else {
        clone = object;
    }

    return clone;
}

/**
 * Very slow array test. Suitable for cross-frame scripting.
 *
 * Suggestion: If you need this and have jQuery loaded, use `jQuery.isArray` instead which is reasonably fast.
 *
 * @param {*} arr - The object to test.
 * @returns {boolean}
 */
unstrungify.crossFramesIsArray = function(arr) { return toString.call(arr) === arrString; }; // eslint-disable-line no-unused-vars

var toString = Object.prototype.toString, arrString = '[object Array]';

module.exports = unstrungify;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLWZpbHRlci9mYWtlXzdmYmU5NGY3LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvQ29sdW1uU2NoZW1hRmFjdG9yeS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL2pzL0RlZmF1bHRGaWx0ZXIuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLWZpbHRlci9qcy9wYXJzZXItQ1FMLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvbWl4LWlucy9iZWhhdmlvci5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL21peC1pbnMvZGF0YU1vZGVsLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvbWl4LWlucy9ncmlkLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2Nzcy1pbmplY3Rvci9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9leHRlbmQtbWUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvaHRtbC9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9Db25kaXRpb25hbHMuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvRmlsdGVyTGVhZi5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9GaWx0ZXJOb2RlLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL0ZpbHRlclRyZWUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvVGVtcGxhdGVzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL2V4dGVuc2lvbnMvY29sdW1ucy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9wYXJzZXItU1FMLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL3N0eWxlc2hlZXQuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvdHJlZS1vcGVyYXRvcnMuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvb2JqZWN0LWl0ZXJhdG9ycy9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9vdmVycmlkZXIvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvcG9wLW1lbnUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvcmVnZXhwLWxpa2UvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvdGVtcGxleC9pbmRleC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy91bnN0cnVuZ2lmeS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRGVmYXVsdEZpbHRlciA9IHJlcXVpcmUoJy4vanMvRGVmYXVsdEZpbHRlcicpO1xudmFyIENvbHVtblNjaGVtYUZhY3RvcnkgPSByZXF1aXJlKCcuL2pzL0NvbHVtblNjaGVtYUZhY3RvcnknKTtcblxuLyoqXG4gKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICogQHBhcmFtIHtvYmplY3R9IFt0YXJnZXRzXSAtIEhhc2ggb2YgbWl4aW4gdGFyZ2V0cy4gVGhlc2UgYXJlIHR5cGljYWxseSBwcm90b3R5cGUgb2JqZWN0cy4gSWYgbm90IGdpdmVuIG9yIGFueSB0YXJnZXRzIGFyZSBtaXNzaW5nLCBkZWZhdWx0cyB0byBjdXJyZW50IGdyaWQncyB2YXJpb3VzIHByb3RvdHlwZXMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSHlwZXJmaWx0ZXIoZ3JpZCwgdGFyZ2V0cykge1xuICAgIHRoaXMuZ3JpZCA9IGdyaWQ7XG4gICAgdGFyZ2V0cyA9IHRhcmdldHMgfHwge307XG5cbiAgICBtaXhJblRvKCdIeXBlcmdyaWQnLCBncmlkLCByZXF1aXJlKCcuL21peC1pbnMvZ3JpZCcpKTtcbiAgICBtaXhJblRvKCdCZWhhdmlvcicsIGdyaWQuYmVoYXZpb3IsIHJlcXVpcmUoJy4vbWl4LWlucy9iZWhhdmlvcicpKTtcbiAgICBtaXhJblRvKCdEYXRhTW9kZWwnLCBncmlkLmJlaGF2aW9yLmRhdGFNb2RlbCwgcmVxdWlyZSgnLi9taXgtaW5zL2RhdGFNb2RlbCcpKTtcblxuICAgIGZ1bmN0aW9uIG1peEluVG8odGFyZ2V0LCBpbnN0YW5jZSwgbWl4aW4pIHtcbiAgICAgICAgdmFyIG9iamVjdCA9IHRhcmdldHNbdGFyZ2V0XTtcbiAgICAgICAgdmFyIHByb3RvdHlwZSA9IG9iamVjdCAmJiBvYmplY3QucHJvdG90eXBlIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZihpbnN0YW5jZSk7XG5cbiAgICAgICAgcHJvdG90eXBlLm1peEluKG1peGluKTtcbiAgICB9XG59XG5cbkh5cGVyZmlsdGVyLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogSHlwZXJmaWx0ZXIucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuXG4gICAgJCRDTEFTU19OQU1FOiAnSHlwZXJmaWx0ZXInLFxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgY2FzZVNlbnNpdGl2ZURhdGE6IHRydWUsXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXNlU2Vuc2l0aXZlQ29sdW1uTmFtZXM6IHRydWUsXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICByZXNvbHZlQWxpYXNlczogZmFsc2UsXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGRlZmF1bHRDb2x1bW5GaWx0ZXJPcGVyYXRvcjogJycsIC8vIGJsYW5rIG1lYW5zIHVzZSBkZWZhdWx0ICgnPScpXG5cbiAgICAvKipcbiAgICAgKiBDYWxsIHRoaXMgYmVmb3JlIGNhbGxpbmcgYGNyZWF0ZWAgaWYgeW91IHdhbnQgdG8gb3JnYW5pemUgYW5kL29yIHNvcnQgeW91ciBzY2hlbWEuXG4gICAgICovXG4gICAgZGVyaXZlU2NoZW1hOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5mYWN0b3J5ID0gbmV3IENvbHVtblNjaGVtYUZhY3RvcnkodGhpcy5ncmlkLmJlaGF2aW9yLmNvbHVtbnMpO1xuICAgIH0sXG4gICAgb3JnYW5pemVTY2hlbWE6IGZ1bmN0aW9uKGNvbHVtbkdyb3Vwc1JlZ2V4LCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZmFjdG9yeS5vcmdhbml6ZShjb2x1bW5Hcm91cHNSZWdleCwgb3B0aW9ucyk7XG4gICAgfSxcbiAgICBzb3J0U2NoZW1hOiBmdW5jdGlvbihzdWJtZW51UGxhY2VtZW50KSB7XG4gICAgICAgIHRoaXMuZmFjdG9yeS5zb3J0KHN1Ym1lbnVQbGFjZW1lbnQpO1xuICAgIH0sXG4gICAgbG9va3VwSW5TY2hlbWE6IGZ1bmN0aW9uKGZpbmRPcHRpb25zLCB2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5mYWN0b3J5Lmxvb2t1cChmaW5kT3B0aW9ucywgdmFsdWUpO1xuICAgIH0sXG4gICAgd2Fsa1NjaGVtYTogZnVuY3Rpb24oaXRlcmF0ZWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmFjdG9yeS53YWxrKGl0ZXJhdGVlKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHttZW51SXRlbVtdfSBbc2NoZW1hXSAtIElmIG9taXR0ZWQsIHVzZSBkZXJpdmVkIHNjaGVtYS4gSWYgbm8gZGVyaXZlZCBzY2hlbWEsIGRlcml2ZSBpdCBub3cuXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbihzY2hlbWEpIHtcbiAgICAgICAgaWYgKCFzY2hlbWEpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5mYWN0b3J5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXJpdmVTY2hlbWEoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNjaGVtYSA9IHRoaXMuZmFjdG9yeS5zY2hlbWE7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5mYWN0b3J5OyAvLyBmb3JjZSBuZXcgc2NoZW1hIGVhY2ggY2FsbCB0byBjcmVhdGVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IERlZmF1bHRGaWx0ZXIoe1xuICAgICAgICAgICAgc2NoZW1hOiBzY2hlbWEsXG4gICAgICAgICAgICBjYXNlU2Vuc2l0aXZlRGF0YTogdGhpcy5jYXNlU2Vuc2l0aXZlRGF0YSxcbiAgICAgICAgICAgIGNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lczogdGhpcy5jYXNlU2Vuc2l0aXZlQ29sdW1uTmFtZXMsXG4gICAgICAgICAgICByZXNvbHZlQWxpYXNlczogdGhpcy5yZXNvbHZlQWxpYXNlcyxcbiAgICAgICAgICAgIGRlZmF1bHRDb2x1bW5GaWx0ZXJPcGVyYXRvcjogdGhpcy5kZWZhdWx0Q29sdW1uRmlsdGVyT3BlcmF0b3JcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIeXBlcmZpbHRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHBvcE1lbnUgPSByZXF1aXJlKCdwb3AtbWVudScpO1xuXG4vKipcbiAqIEBjbGFzc2Rlc2MgQnVpbGQsIG9yZ2FuaXplLCBhbmQgc29ydCBhIGNvbHVtbiBzY2hlbWEgbGlzdCBmcm9tIGEgbGlzdCBvZiBjb2x1bW5zLlxuICpcbiAqIEZpbHRlclRyZWUgcmVxdWlyZXMgYSBjb2x1bW4gc2NoZW1hLiBBcyBhIGZhbGxiYWNrIHdoZW4geW91IGRvbid0IGhhdmUgYSBjb2x1bW4gc2NoZW1hIG9mIHlvdXIgb3duLCB0aGUgc3RyaW5nIGFycmF5IHJldHVybmVkIGJ5IGJlaGF2aW9yLmRhdGFNb2RlbC5nZXRGaWVsZHMoKSB3b3VsZCB3b3JrIGFzIGlzLiBUaGlzIGZhY3Rvcnkgb2JqZWN0IHdpbGwgZG8gYSBsaXR0bGUgYmV0dGVyIHRoYW4gdGhhdCwgdGFraW5nIEh5cGVyZ3JpZCdzIGNvbHVtbiBhcnJheSBhbmQgY3JlYXRpbmcgYSBtb3JlIHRleHR1cmVkIGNvbHVtbiBzY2hlbWEsIGluY2x1ZGluZyBjb2x1bW4gYWxpYXNlcyBhbmQgdHlwZXMuXG4gKlxuICogQ0FWRUFUOiBTZXQgdXAgdGhlIHNjaGVtYSBjb21wbGV0ZWx5IGJlZm9yZSBpbnN0YW50aWF0aW5nIHlvdXIgZmlsdGVyIHN0YXRlLiBGaWx0ZXItdHJlZSB1c2VzIHRoZSBzY2hlbWEgKGluIHBhcnQpIHRvIGdlbmVyYXRlIGNvbHVtbiBzZWxlY3Rpb24gZHJvcC1kb3ducyBhcyBwYXJ0IG9mIGl0cyBcInF1ZXJ5IGJ1aWxkZXJcIiBVSS4gTm90ZSB0aGF0IHRoZSBVSSBpcyAqbm90KiBhdXRvbWF0aWNhbGx5IHVwZGF0ZWQgaWYgeW91IGNoYW5nZSB0aGUgc2NoZW1hIGxhdGVyLlxuICpcbiAqIEBwYXJhbSB7Q29sdW1uW119IGNvbHVtbnNcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBDb2x1bW5TY2hlbWFGYWN0b3J5KGNvbHVtbnMpIHtcbiAgICAvKipcbiAgICAgKiBUaGlzIGlzIHRoZSBvdXRwdXQgcHJvZHVjZWQgYnkgdGhlIGZhY3RvcnkuXG4gICAgICogQHR5cGUge21lbnVJdGVtW119XG4gICAgICovXG4gICAgdGhpcy5zY2hlbWEgPSBjb2x1bW5zLm1hcChmdW5jdGlvbihjb2x1bW4pIHtcbiAgICAgICAgdmFyIGl0ZW0gPSB7XG4gICAgICAgICAgICBuYW1lOiBjb2x1bW4ubmFtZSxcbiAgICAgICAgICAgIGFsaWFzOiBjb2x1bW4uaGVhZGVyLFxuICAgICAgICAgICAgdHlwZTogY29sdW1uLmdldFR5cGUoKVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChjb2x1bW4uY2FsY3VsYXRvcikge1xuICAgICAgICAgICAgaXRlbS5jYWxjdWxhdG9yID0gY29sdW1uLmNhbGN1bGF0b3I7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICB9KTtcbn1cblxudmFyIHBsYWNlbWVudFByZWZpeE1hcCA9IHtcbiAgICB0b3A6ICdcXHUwMDAwJyxcbiAgICBib3R0b206ICdcXHVmZmZmJyxcbiAgICB1bmRlZmluZWQ6ICcnXG59O1xuXG5Db2x1bW5TY2hlbWFGYWN0b3J5LnByb3RvdHlwZSA9IHtcblxuICAgIGNvbnN0cnVjdG9yOiBDb2x1bW5TY2hlbWFGYWN0b3J5LnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgIC8qKlxuICAgICAqIE9yZ2FuaXplIHNjaGVtYSBpbnRvIHN1Ym1lbnVzLlxuICAgICAqIEBwYXJhbSB7UmVnRXhwfSBjb2x1bW5Hcm91cHNSZWdleCAtIFNjaGVtYSBuYW1lcyBvciBhbGlhc2VzIHRoYXQgbWF0Y2ggdGhpcyBhcmUgcHV0IGludG8gYSBzdWJtZW51LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5rZXk9J25hbWUnXSAtIE11c3QgYmUgZWl0aGVyICduYW1lJyBvciAnYWxpYXMnLlxuICAgICAqL1xuICAgIG9yZ2FuaXplOiBmdW5jdGlvbihjb2x1bW5Hcm91cHNSZWdleCwgb3B0aW9ucykge1xuICAgICAgICB2YXIga2V5ID0gb3B0aW9ucyAmJiBvcHRpb25zLmtleSB8fCAnbmFtZScsXG4gICAgICAgICAgICBzdWJtZW51cyA9IHt9LFxuICAgICAgICAgICAgbWVudSA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gaXRlbVtrZXldLFxuICAgICAgICAgICAgICAgIGdyb3VwID0gdmFsdWUubWF0Y2goY29sdW1uR3JvdXBzUmVnZXgpO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgZ3JvdXAgPSBncm91cFswXTtcbiAgICAgICAgICAgICAgICBpZiAoIShncm91cCBpbiBzdWJtZW51cykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3VibWVudXNbZ3JvdXBdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGdyb3VwLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJtZW51OiBbXVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdWJtZW51c1tncm91cF0uc3VibWVudS5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW51LnB1c2goaXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAodmFyIHN1Ym1lbnVOYW1lIGluIHN1Ym1lbnVzKSB7XG4gICAgICAgICAgICBtZW51LnB1c2goc3VibWVudXNbc3VibWVudU5hbWVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gbWVudTtcbiAgICB9LFxuXG4gICAgbG9va3VwOiBmdW5jdGlvbihmaW5kT3B0aW9ucywgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHBvcE1lbnUubG9va3VwLmFwcGx5KHRoaXMuc2NoZW1hLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICB3YWxrOiBmdW5jdGlvbihpdGVyYXRlZSkge1xuICAgICAgICByZXR1cm4gcG9wTWVudS53YWxrLmFwcGx5KHRoaXMuc2NoZW1hLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTb3J0IHRoZSBzY2hlbWEuXG4gICAgICogQGRlc2MgV2FsayB0aGUgbWVudSBzdHJ1Y3R1cmUsIHNvcnRpbmcgZWFjaCBzdWJtZW51IHVudGlsIGZpbmFsbHkgdGhlIHRvcC1sZXZlbCBtZW51IGlzIHNvcnRlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtzdWJtZW51UGxhY2VtZW50XSAtIE9uZSBvZjpcbiAgICAgKiAqIGAndG9wJ2AgLSBQbGFjZSBhbGwgdGhlIHN1Ym1lbnVzIGF0IHRoZSB0b3Agb2YgZWFjaCBlbmNsb3Npbmcgc3VibWVudS5cbiAgICAgKiAqIGAnYm90dG9tJ2AgLSBQbGFjZSBhbGwgdGhlIHN1Ym1lbnVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBlbmNsb3Npbmcgc3VibWVudS5cbiAgICAgKiAqIGB1bmRlZmluZWRgIChvciBvbWl0dGVkKSAtIEdpdmUgbm8gc3BlY2lhbCB0cmVhdG1lbnQgdG8gc3VibWVudXMuXG4gICAgICovXG4gICAgc29ydDogZnVuY3Rpb24oc3VibWVudVBsYWNlbWVudCkge1xuICAgICAgICB2YXIgcHJlZml4ID0gcGxhY2VtZW50UHJlZml4TWFwW3N1Ym1lbnVQbGFjZW1lbnRdO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hLnNvcnQoZnVuY3Rpb24gcmVjdXJzZShhLCBiKSB7XG4gICAgICAgICAgICBpZiAoYS5sYWJlbCAmJiAhYS5zb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBhLnN1Ym1lbnUuc29ydChyZWN1cnNlKTtcbiAgICAgICAgICAgICAgICBhLnNvcnRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhID0gYS5sYWJlbCA/IHByZWZpeCArIGEubGFiZWwgOiBhLmFsaWFzIHx8IGEubmFtZSB8fCBhO1xuICAgICAgICAgICAgYiA9IGIubGFiZWwgPyBwcmVmaXggKyBiLmxhYmVsIDogYi5hbGlhcyB8fCBiLm5hbWUgfHwgYjtcbiAgICAgICAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMDtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2x1bW5TY2hlbWFGYWN0b3J5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRmlsdGVyVHJlZSA9IHJlcXVpcmUoJ2ZpbHRlci10cmVlJyk7XG52YXIgUGFyc2VyQ1FMID0gcmVxdWlyZSgnLi9wYXJzZXItQ1FMJyk7XG5cbi8vIEFkZCBhIHByb3BlcnR5IGBtZW51TW9kZXNgIHRvIHRoIGUgdHJlZSwgZGVmYXVsdGluZyB0byBgb3BlcmF0b3JzYCBhcyB0aGUgb25seSBhY3RpdmUgbW9kZVxuRmlsdGVyVHJlZS5Ob2RlLm9wdGlvbnNTY2hlbWEubWVudU1vZGVzID0ge1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgb3BlcmF0b3JzOiAxXG4gICAgfVxufTtcblxuLy8gQWRkIGBvcE1lbnVHcm91cHNgIHRvIHByb3RvdHlwZSBiZWNhdXNlIG5lZWRlZCBieSBGaWx0ZXJCb3guXG5GaWx0ZXJUcmVlLk5vZGUucHJvdG90eXBlLm9wTWVudUdyb3VwcyA9IEZpbHRlclRyZWUuQ29uZGl0aW9uYWxzLmdyb3VwcztcblxuZnVuY3Rpb24gcXVvdGUodGV4dCkge1xuICAgIHZhciBxdCA9IFBhcnNlckNRTC5xdDtcbiAgICByZXR1cm4gcXQgKyB0ZXh0LnJlcGxhY2UobmV3IFJlZ0V4cChxdCwgJ2cnKSwgcXQgKyBxdCkgKyBxdDtcbn1cblxudmFyIGxpa2VEcmVzc2VzID0gW1xuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgJSguKyklJC9pLCBvcGVyYXRvcjogJ2NvbnRhaW5zJyB9LFxuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgKC4rKSUkL2ksIG9wZXJhdG9yOiAnYmVnaW5zJyB9LFxuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgJSguKykkL2ksIG9wZXJhdG9yOiAnZW5kcycgfVxuXTtcbnZhciByZWdleEVzY2FwZWRMaWtlUGF0dGVybkNoYXJzID0gL1xcWyhbX1xcW1xcXSVdKVxcXS9nOyAvLyBjYXB0dXJlIGFsbCBfLCBbLCBdLCBhbmQgJSBjaGFycyBlbmNsb3NlZCBpbiBbXVxudmFyIHJlZ2V4TGlrZVBhdHRlcm5DaGFyID0gL1tfXFxbXFxdJV0vOyAvLyBmaW5kIGFueSBfLCBbLCBdLCBhbmQgJSBjaGFycyBOT1QgZW5jbG9zZWQgaW4gW11cblxuLy8gY29udmVydCBjZXJ0YWluIExJS0UgZXhwcmVzc2lvbnMgdG8gQkVHSU5TLCBFTkRTLCBDT05UQUlOU1xuZnVuY3Rpb24gY29udmVydExpa2VUb1BzZXVkb09wKHJlc3VsdCkge1xuICAgIGxpa2VEcmVzc2VzLmZpbmQoZnVuY3Rpb24oZHJlc3MpIHtcbiAgICAgICAgdmFyIG1hdGNoID0gcmVzdWx0Lm1hdGNoKGRyZXNzLnJlZ2V4KTtcblxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIC8vIHVuZXNjYXBlIGFsbCBMSUtFIHBhdHRlcm4gY2hhcnMgZXNjYXBlZCB3aXRoIGJyYWNrZXRzXG4gICAgICAgICAgICB2YXIgbm90ID0gKG1hdGNoWzFdIHx8ICcnKS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yID0gZHJlc3Mub3BlcmF0b3IsXG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1hdGNoWzJdLFxuICAgICAgICAgICAgICAgIG9wZXJhbmRXaXRob3V0RXNjYXBlZENoYXJzID0gb3BlcmFuZC5yZXBsYWNlKHJlZ2V4RXNjYXBlZExpa2VQYXR0ZXJuQ2hhcnMsICcnKTtcblxuICAgICAgICAgICAgLy8gaWYgcmVzdWx0IGhhcyBubyBhY3R1YSByZW1haW5pbmcgTElLRSBwYXR0ZXJuIGNoYXJzLCBnbyB3aXRoIHRoZSBjb252ZXJzaW9uXG4gICAgICAgICAgICBpZiAoIXJlZ2V4TGlrZVBhdHRlcm5DaGFyLnRlc3Qob3BlcmFuZFdpdGhvdXRFc2NhcGVkQ2hhcnMpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG9wZXJhbmQucmVwbGFjZShyZWdleEVzY2FwZWRMaWtlUGF0dGVybkNoYXJzLCAnJDEnKTsgLy8gdW5lc2NhcGUgdGhlIGVzY2FwZWQgY2hhcnNcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBub3QgKyBvcGVyYXRvciArICcgJyArIG9wZXJhbmQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG52YXIgY29uZGl0aW9uYWxzQ1FMID0gbmV3IEZpbHRlclRyZWUuQ29uZGl0aW9uYWxzKCk7XG5jb25kaXRpb25hbHNDUUwubWFrZUxJS0UgPSBmdW5jdGlvbihiZWcsIGVuZCwgb3AsIG9yaWdpbmFsT3AsIGMpIHtcbiAgICBvcCA9IG9yaWdpbmFsT3AudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gb3AgKyAnICcgKyBxdW90ZShjLm9wZXJhbmQpO1xufTtcbmNvbmRpdGlvbmFsc0NRTC5tYWtlSU4gPSBmdW5jdGlvbihvcCwgYykge1xuICAgIHJldHVybiBvcC50b0xvd2VyQ2FzZSgpICsgJyAoJyArIGMub3BlcmFuZC5yZXBsYWNlKC9cXHMqLFxccyovZywgJywgJykgKyAnKSc7XG59O1xuY29uZGl0aW9uYWxzQ1FMLm1ha2UgPSBmdW5jdGlvbihvcCwgYykge1xuICAgIHZhciBudW1lcmljT3BlcmFuZDtcbiAgICBvcCA9IG9wLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKC9cXHcvLnRlc3Qob3ApKSB7IG9wICs9ICcgJzsgfVxuICAgIG9wICs9IGMuZ2V0VHlwZSgpID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obnVtZXJpY09wZXJhbmQgPSBOdW1iZXIoYy5vcGVyYW5kKSlcbiAgICAgICAgPyBudW1lcmljT3BlcmFuZFxuICAgICAgICA6IHF1b3RlKGMub3BlcmFuZCk7XG4gICAgcmV0dXJuIG9wO1xufTtcblxuLy8gcmVwbGFjZSB0aGUgZGVmYXVsdCBmaWx0ZXIgdHJlZSB0ZXJtaW5hbCBub2RlIGNvbnN0cnVjdG9yIHdpdGggYW4gZXh0ZW5zaW9uIG9mIHNhbWVcbnZhciBDdXN0b21GaWx0ZXJMZWFmID0gRmlsdGVyVHJlZS5wcm90b3R5cGUuYWRkRWRpdG9yKHtcbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0LFxuICAgICAgICAgICAgc3ludGF4ID0gb3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheDtcblxuICAgICAgICBpZiAoc3ludGF4ID09PSAnQ1FMJykge1xuICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5nZXRTeW50YXgoY29uZGl0aW9uYWxzQ1FMKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGNvbnZlcnRMaWtlVG9Qc2V1ZG9PcChyZXN1bHQpO1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRPcCA9IHRoaXMuc2NoZW1hLmxvb2t1cCh0aGlzLmNvbHVtbikuZGVmYXVsdE9wIHx8IHRoaXMucm9vdC5wYXJzZXJDUUwuZGVmYXVsdE9wOyAvLyBtaW1pY3MgbG9naWMgaW4gcGFyc2VyLUNRTC5qcywgbGluZSAxMTBcbiAgICAgICAgICAgIGlmIChyZXN1bHQudG9VcHBlckNhc2UoKS5pbmRleE9mKGRlZmF1bHRPcCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuc3Vic3RyKGRlZmF1bHRPcC5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gRmlsdGVyVHJlZS5MZWFmLnByb3RvdHlwZS5nZXRTdGF0ZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59KTtcblxuRmlsdGVyVHJlZS5wcm90b3R5cGUuYWRkRWRpdG9yKCdDb2x1bW5zJyk7XG5cbi8vIEFkZCBzb21lIG5vZGUgdGVtcGxhdGVzIGJ5IHVwZGF0aW5nIHNoYXJlZCBpbnN0YW5jZSBvZiBGaWx0ZXJOb2RlJ3MgdGVtcGxhdGVzLiAoT0sgdG8gbXV0YXRlIHNoYXJlZCBpbnN0YW5jZTsgZmlsdGVyLXRyZWUgbm90IGJlaW5nIHVzZWQgZm9yIGFueXRoaW5nIGVsc2UgaGVyZS4gQWx0ZXJuYXRpdmVseSwgd2UgY291bGQgaGF2ZSBpbnN0YW50aWF0ZWQgYSBuZXcgVGVtcGxhdGVzIG9iamVjdCBmb3Igb3VyIERlZmF1bHRGaWx0ZXIgcHJvdG90eXBlLCBhbHRob3VnaCB0aGlzIHdvdWxkIG9ubHkgYWZmZWN0IHRyZWUgbm9kZXMsIG5vdCBsZWFmIG5vZGVzLCBidXQgdGhhdCB3b3VsZCBiZSBvayBpbiB0aGlzIGNhc2Ugc2luY2UgdGhlIGFkZGl0aW9ucyBiZWxvdyBhcmUgdHJlZSBub2RlIHRlbXBsYXRlcy4pXG5PYmplY3QuYXNzaWduKEZpbHRlclRyZWUuTm9kZS5wcm90b3R5cGUudGVtcGxhdGVzLCB7XG4gICAgY29sdW1uRmlsdGVyOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbiAgICAgICAgJyAgIDxzdHJvbmc+PHNwYW4+ezJ9IDwvc3Bhbj48L3N0cm9uZz48YnI+JyxcbiAgICAgICAgJyAgIE1hdGNoJyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1hbmRcIj5hbGw8L2xhYmVsPicsXG4gICAgICAgICcgICA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3Atbm9yXCI+bm9uZTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIG9mIHRoZSBmb2xsb3dpbmc6JyxcbiAgICAgICAgJyAgIDxzZWxlY3Q+JyxcbiAgICAgICAgJyAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4gICAgICAgICcgICA8L3NlbGVjdD4nLFxuICAgICAgICAnICAgPG9sPjwvb2w+JyxcbiAgICAgICAgJzwvc3Bhbj4nXG4gICAgXVxuICAgICAgICAuam9pbignXFxuJyksXG5cbiAgICBjb2x1bW5GaWx0ZXJzOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlIGZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnNcIj4nLFxuICAgICAgICAnICAgTWF0Y2ggPHN0cm9uZz5hbGw8L3N0cm9uZz4gb2YgdGhlIGZvbGxvd2luZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb25zOicsXG4gICAgICAgICcgICA8b2w+PC9vbD4nLFxuICAgICAgICAnPC9zcGFuPidcbiAgICBdXG4gICAgICAgIC5qb2luKCdcXG4nKVxufSk7XG5cbi8qKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAZGVzYyBUaGlzIGV4dGVuc2lvbiBvZiBGaWx0ZXJUcmVlIGZvcmNlcyBhIHNwZWNpZmljIHRyZWUgc3RydWN0dXJlLlxuICogU2VlIHtAbGluayBtYWtlTmV3Um9vdH0gZm9yIGEgZGVzY3JpcHRpb24uXG4gKlxuICogU2VlIGFsc28ge0B0dXRvcmlhbCBmaWx0ZXItYXBpfS5cbiAqXG4gKiBAcGFyYW0ge0ZpbHRlclRyZWVPcHRpb25zT2JqZWN0fSBvcHRpb25zIC0gWW91IHNob3VsZCBwcm92aWRlIGEgY29sdW1uIHNjaGVtYS4gVGhlIGVhc2llc3QgYXBwcm9hY2ggaXMgdG8gcHJvdmlkZSBhIHNjaGVtYSBmb3IgdGhlIGVudGlyZSBmaWx0ZXIgdHJlZSB0aHJvdWdoIGBvcHRpb25zLnNjaGVtYWAuXG4gKlxuICogQWx0aG91Z2ggbm90IHJlY29tbWVuZGVkLCB0aGUgY29sdW1uIHNjaGVtYSBjYW4gYWxzbyBiZSBlbWJlZGRlZCBpbiB0aGUgc3RhdGUgb2JqZWN0LCBlaXRoZXIgYXQgdGhlIHJvb3QsIGBvcHRpb25zLnN0YXRlLnNjaGVtYWAsIG9yIGZvciBhbnkgZGVzY2VuZGFudCBub2RlLiBGb3IgZXhhbXBsZSwgYSBzZXBhcmF0ZSBzY2hlbWEgY291bGQgYmUgcHJvdmlkZWQgZm9yIGVhY2ggZXhwcmVzc2lvbiBvciBzdWJleHByZXNzaW9uIHRoYXQgbmVlZCB0byByZW5kZXIgY29sdW1uIGxpc3QgZHJvcC1kb3ducy5cbiAqXG4gKiBOT1RFOiBJZiBgb3B0aW9ucy5zdGF0ZWAgaXMgdW5kZWZpbmVkLCBpdCBpcyBkZWZpbmVkIGluIGBwcmVJbml0aWFsaXplKClgIGFzIGEgbmV3IGVtcHR5IHN0YXRlIHNjYWZmb2xkIChzZWUge0BsaW5rIG1ha2VOZXdSb290fSkgd2l0aCB0aGUgdHdvIHRydW5rcyB0byBob2xkIGEgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycy4gRXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGNhbiBiZSBhZGRlZCB0byB0aGlzIGVtcHR5IHNjYWZmb2xkIGVpdGhlciBwcm9ncmFtbWF0aWNhbGx5IG9yIHRocm91Z2ggdGhlIFF1ZXJ5IEJ1aWxkZXIgVUkuXG4gKi9cbnZhciBEZWZhdWx0RmlsdGVyID0gRmlsdGVyVHJlZS5leHRlbmQoJ0RlZmF1bHRGaWx0ZXInLCB7XG4gICAgcHJlSW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGRlZmF1bHQgXCJIeXBlcmZpbHRlclwiIHByb2ZpbGUgKHNlZSBmdW5jdGlvbiBjb21tZW50cylcbiAgICAgICAgdmFyIHN0YXRlID0gb3B0aW9ucy5zdGF0ZSA9IG9wdGlvbnMuc3RhdGUgfHwgdGhpcy5tYWtlTmV3Um9vdCgpO1xuXG4gICAgICAgIC8vIFVwb24gY3JlYXRpb24gb2YgYSAnY29sdW1uRmlsdGVyJyBub2RlLCBmb3JjZSB0aGUgc2NoZW1hIHRvIHRoZSBvbmUgY29sdW1uXG4gICAgICAgIGlmICgob3B0aW9ucy50eXBlIHx8IHN0YXRlICYmIHN0YXRlLnR5cGUpID09PSAnY29sdW1uRmlsdGVyJykge1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBbXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnQucm9vdC5zY2hlbWEubG9va3VwKHN0YXRlLmNoaWxkcmVuWzBdLmNvbHVtbilcbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW29wdGlvbnNdO1xuICAgIH0sXG5cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcblxuICAgICAgICBpZiAoIXRoaXMucGFyZW50KSB7XG4gICAgICAgICAgICB0aGlzLmV4dHJhY3RTdWJ0cmVlcygpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHBvc3RJbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGlmICh0aGlzID09PSB0aGlzLnJvb3QgJiYgIXRoaXMucGFyc2VyQ1FMKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlckNRTCA9IG5ldyBQYXJzZXJDUUwodGhpcy5jb25kaXRpb25hbHMub3BzLCB7XG4gICAgICAgICAgICAgICAgc2NoZW1hOiB0aGlzLnNjaGVtYSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0T3A6IG9wdGlvbnMuZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09ICdjb2x1bW5GaWx0ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmRvbnRQZXJzaXN0LnNjaGVtYSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGNvbnZlbmllbmNlIHZhcnMgdG8gcmVmZXJlbmNlIHRoZSAyIHJvb3QgXCJIeXBlcmZpbHRlclwiIG5vZGVzXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZXh0cmFjdFN1YnRyZWVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJvb3ROb2RlcyA9IHRoaXMucm9vdC5jaGlsZHJlbjtcbiAgICAgICAgdGhpcy50YWJsZUZpbHRlciA9IHJvb3ROb2Rlc1swXTtcbiAgICAgICAgdGhpcy5jb2x1bW5GaWx0ZXJzID0gcm9vdE5vZGVzWzFdO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBNYWtlIGEgbmV3IGVtcHR5IEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZSBzdGF0ZSBvYmplY3QuXG4gICAgICogQGRlc2MgVGhpcyBmdW5jdGlvbiBtYWtlcyBhIG5ldyBkZWZhdWx0IHN0YXRlIG9iamVjdCBhcyB1c2VkIGJ5IEh5cGVyZ3JpZCwgYSByb290IHdpdGggZXhhY3RseSB0d28gXCJ0cnVua3MuXCJcbiAgICAgKlxuICAgICAqID4gKipEZWZpbml0aW9uOioqIEEgKnRydW5rKiBpcyBkZWZpbmVkIGFzIGEgY2hpbGQgbm9kZSB3aXRoIGEgdHJ1dGh5IGBrZWVwYCBwcm9wZXJ0eSwgbWFraW5nIHRoaXMgbm9kZSBpbW11bmUgdG8gdGhlIHVzdWFsIHBydW5pbmcgdGhhdCB3b3VsZCBvY2N1ciB3aGVuIGl0IGhhcyBubyBjaGlsZCBub2RlcyBvZiBpdHMgb3duLiBUbyBiZSBhIHRydWUgdHJ1bmssIGFsbCBhbmNlc3RvciBub2RlcyB0byBiZSB0cnVua3MgYXMgd2VsbC4gTm90ZSB0aGF0IHRoZSByb290IGlzIGEgbmF0dXJhbCB0cnVuazsgaXQgZG9lcyBub3QgcmVxdWlyZSBhIGBrZWVwYCBwcm9wZXJ0eS5cbiAgICAgKlxuICAgICAqIFRoZSB0d28gdHJ1bmtzIG9mIHRoZSBIeXBlcmdyaWQgZmlsdGVyIGFyZTpcbiAgICAgKiAqIFRoZSAqKlRhYmxlIEZpbHRlcioqIChsZWZ0IHRydW5rLCBvciBgY2hpbGRyZW5bMF1gKSwgYSBoaWVyYXJjaHkgb2YgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucy5cbiAgICAgKiAqIFRoZSAqKkNvbHVtbiBGaWx0ZXJzKiogKHJpZ2h0IHRydW5rLCBvciBgY2hpbGRyZW5bMV1gKSwgYSBzZXJpZXMgb2Ygc3ViZXhwcmVzc2lvbnMsIG9uZSBwZXIgYWN0aXZlIGNvbHVtbiBmaWx0ZXIuIEVhY2ggc3ViZXhwcmVzc2lvbiBjb250YWlucyBhbnkgbnVtYmVyIG9mIGV4cHJlc3Npb25zIGJvdW5kIHRvIHRoYXQgY29sdW1uIGJ1dCBubyBmdXJ0aGVyIHN1YmV4cHJlc3Npb25zLlxuICAgICAqXG4gICAgICogVGhlIGBvcGVyYXRvcmAgcHJvcGVydGllcyBmb3IgYWxsIHN1YmV4cHJlc3Npb25zIGRlZmF1bHQgdG8gYCdvcC1hbmQnYCwgd2hpY2ggbWVhbnM6XG4gICAgICogKiBBbGwgdGFibGUgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIGlzIGp1c3QgdGhlIGRlZmF1bHQgYW5kIG1heSBiZSBjaGFuZ2VkIGZyb20gdGhlIFVJLilcbiAgICAgKiAqIEFsbCBleHByZXNzaW9ucyB3aXRoaW4gYSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBpcyBqdXN0IHRoZSBkZWZhdWx0IGFuZCBtYXkgYmUgY2hhbmdlZCBmcm9tIHRoZSBVSS4pXG4gICAgICogKiBBbGwgY29sdW1uIEZpbHRlcnMgc3ViZXhwcmVzc2lvbnMgYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBtYXkgbm90IGJlIGNoYW5nZWQgZnJvbSBVSS4pXG4gICAgICogKiBGaW5hbGx5LCB0aGUgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIG1heSBub3QgYmUgY2hhbmdlZCBmcm9tIFVJLilcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEEgcGxhaW4gb2JqZWN0IHRvIHNlcnZlIGFzIGEgZmlsdGVyLXRyZWUgc3RhdGUgb2JqZWN0IHJlcHJlc2VudGluZyBhIG5ldyBIeXBlcmdyaWQgZmlsdGVyLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFrZU5ld1Jvb3Q6IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHRoaXMudGFibGVGaWx0ZXIgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyB0YWJsZSBmaWx0ZXIgZXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGdvIGhlcmVcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnMgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcnMnLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyBzdWJleHByZXNzaW9ucyB3aXRoIHR5cGUgJ2NvbHVtbkZpbHRlcicgZ28gaGVyZSwgb25lIGZvciBlYWNoIGFjdGl2ZSBjb2x1bW4gZmlsdGVyXG4gICAgICAgICAgICBdXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGZpbHRlciA9IHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUZpbHRlcixcbiAgICAgICAgICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnNcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gZmlsdGVyO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBub2RlLlxuICAgICAqIEBkZXNjIEVhY2ggY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIG5vZGUgaXMgYSBjaGlsZCBub2RlIG9mIHRoZSBgY29sdW1uRmlsdGVyc2AgdHJ1bmsgb2YgdGhlIEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZS5cbiAgICAgKiBFYWNoIHN1Y2ggbm9kZSBjb250YWlucyBhbGwgdGhlIGNvbHVtbiBmaWx0ZXIgZXhwcmVzc2lvbnMgZm9yIHRoZSBuYW1lZCBjb2x1bW4uIEl0IHdpbGwgbmV2ZXIgYmUgZW1wdHk7IGlmIHRoZXJlIGlzIG5vIGNvbHVtbiBmaWx0ZXIgZm9yIHRoZSBuYW1lZCBjb2x1bW4sIGl0IHdvbid0IGV4aXN0IGluIGBjb2x1bW5GaWx0ZXJzYC5cbiAgICAgKlxuICAgICAqIENBVVRJT046IFRoaXMgaXMgdGhlIGFjdHVhbCBub2RlIG9iamVjdC4gRG8gbm90IGNvbmZ1c2UgaXQgd2l0aCB0aGUgY29sdW1uIGZpbHRlciBfc3RhdGVfIG9iamVjdCAoZm9yIHdoaWNoIHNlZSB0aGUge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0Q29sdW1uRmlsdGVyU3RhdGV8Z2V0Q29sdW1uRmlsdGVyU3RhdGUoKX0gbWV0aG9kKS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RGVmYXVsdEZpbHRlcn0gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiB0aGUgY29sdW1uIGZpbHRlciBkb2VzIG5vdCBleGlzdC5cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbk5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sdW1uRmlsdGVycy5jaGlsZHJlbi5maW5kKGZ1bmN0aW9uKGNvbHVtbkZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbkZpbHRlci5jaGlsZHJlbi5sZW5ndGggJiYgY29sdW1uRmlsdGVyLmNoaWxkcmVuWzBdLmNvbHVtbiA9PT0gY29sdW1uTmFtZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gICAgICogU2VlIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdHx0eXBlIGRlZmluaXRpb259IGluIHRoZSBmaWx0ZXItdHJlZSBkb2N1bWVudGF0aW9uLlxuICAgICAqL1xuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3RcbiAgICAgKiBTZWUgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fHR5cGUgZGVmaW5pdGlvbn0gaW4gdGhlIGZpbHRlci10cmVlIGRvY3VtZW50YXRpb24uXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXJTdGF0ZTogZnVuY3Rpb24ocmF3Q29sdW1uTmFtZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSk7XG5cbiAgICAgICAgaWYgKGNvbHVtblNjaGVtYSkge1xuICAgICAgICAgICAgdmFyIHN1YmV4cHJlc3Npb24gPSB0aGlzLmdldENvbHVtbkZpbHRlcihjb2x1bW5TY2hlbWEubmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChzdWJleHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuc3ludGF4ID0gJ0NRTCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHN1YmV4cHJlc3Npb24uZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZGRzIENRTCBzdXBwb3J0IHRvIHRoaXMuZ2V0U3RhdGUoKS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgcGFyc2VyIGVycm9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGB0aGlzLnJvb3QuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldENvbHVtbkZpbHRlclN0YXRlYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0Q29sdW1uRmlsdGVyU3RhdGU6IGZ1bmN0aW9uKHJhd0NvbHVtbk5hbWUsIHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcixcbiAgICAgICAgICAgIHN1YmV4cHJlc3Npb247XG5cbiAgICAgICAgdmFyIGNvbHVtbk5hbWUgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSkubmFtZTtcblxuICAgICAgICBpZiAoIWNvbHVtbk5hbWUpIHtcbiAgICAgICAgICAgIHRocm93ICdVbmtub3duIGNvbHVtbiBuYW1lIFwiJyArIHJhd0NvbHVtbk5hbWUgKyAnXCInO1xuICAgICAgICB9XG5cbiAgICAgICAgc3ViZXhwcmVzc2lvbiA9IHRoaXMuZ2V0Q29sdW1uRmlsdGVyKGNvbHVtbk5hbWUpO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMpOyAvLyBjbG9uZSBpdCBiZWNhdXNlIHdlIG1heSBtdXRhdGUgaXQgYmVsb3dcbiAgICAgICAgICAgIG9wdGlvbnMuc3ludGF4ID0gb3B0aW9ucy5zeW50YXggfHwgJ0NRTCc7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnN5bnRheCA9PT0gJ0NRTCcpIHtcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IHNvbWUgQ1FMIHN0YXRlIHN5bnRheCBpbnRvIGEgZmlsdGVyIHRyZWUgc3RhdGUgb2JqZWN0LlxuICAgICAgICAgICAgICAgIC8vIFRoZXJlIG11c3QgYmUgYXQgbGVhc3Qgb25lIGNvbXBsZXRlIGV4cHJlc3Npb24gb3IgYHN0YXRlYCB3aWxsIGJlY29tZSB1bmRlZmluZWQuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnJvb3QucGFyc2VyQ1FMLnBhcnNlKHN0YXRlLCBjb2x1bW5OYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnN5bnRheCA9ICdvYmplY3QnO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0RlZmF1bHRGaWx0ZXI6IE5vIGNvbXBsZXRlIGV4cHJlc3Npb24uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZXJyb3IpIHsgLy8gcGFyc2Ugc3VjY2Vzc2Z1bFxuICAgICAgICAgICAgICAgIGlmIChzdWJleHByZXNzaW9uKSB7IC8vIHN1YmV4cHJlc3Npb24gYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVwbGFjZSBzdWJleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGlzIGNvbHVtblxuICAgICAgICAgICAgICAgICAgICBzdWJleHByZXNzaW9uLnNldFN0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgYSBuZXcgc3ViZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhpcyBjb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnBhcnNlU3RhdGVTdHJpbmcoc3RhdGUsIG9wdGlvbnMpOyAvLyBiZWNhdXNlIC5hZGQoKSBvbmx5IHRha2VzIG9iamVjdCBzeW50YXhcbiAgICAgICAgICAgICAgICAgICAgc3ViZXhwcmVzc2lvbiA9IHRoaXMuY29sdW1uRmlsdGVycy5hZGQoc3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVycm9yID0gc3ViZXhwcmVzc2lvbi5pbnZhbGlkKG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1YmV4cHJlc3Npb24gJiYgKCFzdGF0ZSB8fCBlcnJvcikpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBzdWJleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGlzIGNvbHVtblxuICAgICAgICAgICAgc3ViZXhwcmVzc2lvbi5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgR2V0IHN0YXRlIG9mIGFsbCBjb2x1bW4gZmlsdGVycy5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldENvbHVtbkZpbHRlcnNTdGF0ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCA9PT0gJ0NRTCcpIHtcbiAgICAgICAgICAgIHRocm93ICdUaGUgQ1FMIHN5bnRheCBpcyBpbnRlbmRlZCBmb3IgdXNlIG9uIGEgc2luZ2xlIGNvbHVtbiBmaWx0ZXIgb25seS4gSXQgZG9lcyBub3Qgc3VwcG9ydCBtdWx0aXBsZSBjb2x1bW5zIG9yIHN1YmV4cHJlc3Npb25zLic7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb2x1bW5GaWx0ZXJzLmdldFN0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgc3RhdGUgb2YgYWxsIGNvbHVtbiBmaWx0ZXJzLlxuICAgICAqIEBkZXNjIE5vdGUgdGhhdCB0aGUgY29sdW1uIGZpbHRlcnMgaW1wbGVtZW50YXRpb24gZGVwZW5kcyBvbiB0aGUgbm9kZXMgaGF2aW5nIGNlcnRhaW4gbWV0YS1kYXRhOyB5b3Ugc2hvdWxkIG5vdCBiZSBjYWxsaW5nIHRoaXMgd2l0aG91dCB0aGVzZSBtZXRhLWRhdGEgYmVpbmcgaW4gcGxhY2UuIFNwZWNpZmljYWxseSBgdHlwZSA9ICdjb2x1bW5GaWx0ZXJzJ2AgYW5kICBga2VlcCA9IHRydWVgIGZvciB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSBhbmRgdHlwZSA9ICdjb2x1bW5GaWx0ZXInYCBmb3IgZWFjaCBpbmRpdmlkdWFsIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbi4gSW4gYWRkaXRpb24gdGhlIHN1YnRyZWUgb3BlcmF0b3JzIHNob3VsZCBhbHdheXMgYmUgYCdvcC1hbmQnYC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRDb2x1bW5GaWx0ZXJzU3RhdGU6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcjtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMucm9vdC5jb2x1bW5GaWx0ZXJzLnNldFN0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGVycm9yID0gdGhpcy5yb290LmNvbHVtbkZpbHRlcnMuaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlcnJvcjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUYWJsZUZpbHRlclN0YXRlOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4ID09PSAnQ1FMJykge1xuICAgICAgICAgICAgdGhyb3cgJ1RoZSBDUUwgc3ludGF4IGlzIGludGVuZGVkIGZvciB1c2Ugb24gYSBzaW5nbGUgY29sdW1uIGZpbHRlciBvbmx5LiBJdCBkb2VzIG5vdCBzdXBwb3J0IG11bHRpcGxlIGNvbHVtbnMgb3Igc3ViZXhwcmVzc2lvbnMuJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yb290LnRhYmxlRmlsdGVyLmdldFN0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRhYmxlRmlsdGVyU3RhdGU6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcjtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMucm9vdC50YWJsZUZpbHRlci5zZXRTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBlcnJvciA9IHRoaXMucm9vdC50YWJsZUZpbHRlci5pbnZhbGlkKG9wdGlvbnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yb290LnRhYmxlRmlsdGVyLmNoaWxkcmVuLmxlbmd0aCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIFRoZSBDUUwgc3ludGF4IHNob3VsZCBvbmx5IGJlIHJlcXVlc3RlZCBmb3IgYSBzdWJ0cmVlIGNvbnRhaW5pbmcgaG9tb2dlbmVvdXMgY29sdW1uIG5hbWVzIGFuZCBubyBzdWJleHByZXNzaW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J29iamVjdCddIC0gSWYgYCdDUUwnYCwgd2Fsa3MgdGhlIHRyZWUsIHJldHVybmluZyBhIHN0cmluZyBzdWl0YWJsZSBmb3IgYSBIeXBlcmdyaWQgZmlsdGVyIGNlbGwuIEFsbCBvdGhlciB2YWx1ZXMgYXJlIGZvcndhcmRlZCB0byB0aGUgcHJvdG90eXBlJ3MgYGdldFN0YXRlYCBtZXRob2QgZm9yIGZ1cnRoZXIgaW50ZXJwcmV0YXRpb24uXG4gICAgICpcbiAgICAgKiBOT1RFOiBDUUwgaXMgbm90IGludGVuZGVkIHRvIGJlIHVzZWQgb3V0c2lkZSB0aGUgY29udGV4dCBvZiBhIGBjb2x1bW5GaWx0ZXJzYCBzdWJleHByZXNzaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4O1xuXG4gICAgICAgIGlmIChzeW50YXggPT09ICdDUUwnKSB7XG4gICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSB0aGlzLm9wZXJhdG9yLnN1YnN0cigzKTsgLy8gcmVtb3ZlIHRoZSAnb3AtJyBwcmVmaXhcbiAgICAgICAgICAgIHJlc3VsdCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkLCBpZHgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgQ3VzdG9tRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSAnICcgKyBvcGVyYXRvciArICcgJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBjaGlsZC5nZXRTdGF0ZShvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRGVmYXVsdEZpbHRlcjogRXhwZWN0ZWQgYSBjb25kaXRpb25hbCBidXQgZm91bmQgYSBzdWJleHByZXNzaW9uLiBTdWJleHByZXNzaW9ucyBhcmUgbm90IHN1cHBvcnRlZCBpbiBDUUwgKENvbHVtbiBRdWVyeSBMYW5ndWFnZSwgdGhlIGZpbHRlciBjZWxsIHN5bnRheCkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IEZpbHRlclRyZWUucHJvdG90eXBlLmdldFN0YXRlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgTGlzdCBvZiBmaWx0ZXIgcHJvcGVydGllcyB0byBiZSB0cmVhdGVkIGFzIGZpcnN0IGNsYXNzIG9iamVjdHMuXG4gICAgICogQGRlc2MgT24gZmlsdGVyIHByb3BlcnR5IHNldCwgZm9yIGEgcHJvcGVydHkgdmFsdWUgdGhhdCBpcyBhIGZ1bmN0aW9uOlxuICAgICAqICogSWYgbGlzdGVkIGhlcmUsIGZ1bmN0aW9uIGl0IHNlbGYgaXMgYXNzaWduZWQgdG8gcHJvcGVydHkuXG4gICAgICogKiBJZiBfbm90XyBsaXN0ZWQgaGVyZSwgZnVuY3Rpb24gd2lsbCBiZSBleGVjdXRlZCB0byBnZXQgdmFsdWUgdG8gYXNzaWduIHRvIHByb3BlcnR5LlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpcnN0Q2xhc3NQcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNhbGN1bGF0b3I6IHRydWVcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGltcGxlbWVudHMgZGF0YVNvdXJjZUhlbHBlckFQSSNwcm9wZXJ0aWVzXG4gICAgICogQGRlc2MgTm90ZXMgcmVnYXJkaW5nIHNwZWNpZmljIHByb3BlcnRpZXM6XG4gICAgICogKiBgY2FzZVNlbnNpdGl2ZURhdGFgIChyb290IHByb3BlcnR5KSBwZXJ0YWlucyB0byBzdHJpbmcgY29tcGFyZXMgb25seS4gVGhpcyBpbmNsdWRlcyB1bnR5cGVkIGNvbHVtbnMsIGNvbHVtbnMgdHlwZWQgYXMgc3RyaW5ncywgdHlwZWQgY29sdW1ucyBjb250YWluaW5nIGRhdGEgdGhhdCBjYW5ub3QgYmUgY29lcmNlZCB0byB0eXBlIG9yIHdoZW4gdGhlIGZpbHRlciBleHByZXNzaW9uIG9wZXJhbmQgY2Fubm90IGJlIGNvZXJjZWQuIFRoaXMgaXMgYSBzaGFyZWQgcHJvcGVydHkgYW5kIGFmZmVjdHMgYWxsIGdyaWRzIG1hbmFnZWQgYnkgdGhpcyBpbnN0YW5jZSBvZiB0aGUgYXBwLlxuICAgICAqICogYGNhbGN1bGF0b3JgIChjb2x1bW4gcHJvcGVydHkpIENvbXB1dGVkIGNvbHVtbiBjYWxjdWxhdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMgT25lIG9mOlxuICAgICAqICogKipHZXR0ZXIqKiB0eXBlIGNhbGw6IFZhbHVlIG9mIHJlcXVlc3RlZCBwcm9wZXJ0eSBvciBgbnVsbGAgaWYgdW5kZWZpbmVkLlxuICAgICAqICogKipTZXR0ZXIqKiB0eXBlIGNhbGw6IGB1bmRlZmluZWRgXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBwcm9wZXJ0aWVzOiBmdW5jdGlvbihwcm9wZXJ0aWVzKSB7XG4gICAgICAgIHZhciByZXN1bHQsIHZhbHVlLFxuICAgICAgICAgICAgb2JqZWN0ID0gcHJvcGVydGllcyAmJiBwcm9wZXJ0aWVzLmNvbHVtblxuICAgICAgICAgICAgICAgID8gdGhpcy5zY2hlbWEubG9va3VwKHByb3BlcnRpZXMuY29sdW1uLm5hbWUpXG4gICAgICAgICAgICAgICAgOiB0aGlzLnJvb3Q7XG5cbiAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5nZXRQcm9wTmFtZSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG9iamVjdFtwcm9wZXJ0aWVzLmdldFByb3BOYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydGllc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG9iamVjdFtrZXldO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiAhdGhpcy5maXJzdENsYXNzUHJvcGVydGllc1trZXldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IERlZmF1bHRGaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xuXG52YXIgUkVHRVhQX0JPT0xTID0gL1xcYihBTkR8T1J8Tk9SKVxcYi9naSxcbiAgICBFWFAgPSAnKC4qPyknLCBCUiA9ICdcXFxcYicsXG4gICAgUFJFRklYID0gJ14nICsgRVhQICsgQlIsXG4gICAgSU5GSVggPSBCUiArIEVYUCArIEJSLFxuICAgIFBPU1RGSVggPSBCUiArIEVYUCArICckJztcblxuZnVuY3Rpb24gUGFyc2VyQ3FsRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5QYXJzZXJDcWxFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5QYXJzZXJDcWxFcnJvci5wcm90b3R5cGUubmFtZSA9ICdQYXJzZXJDcWxFcnJvcic7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHN1bW1hcnkgQ29sdW1uIFF1ZXJ5IExhbmd1YWdlIChDUUwpIHBhcnNlclxuICpcbiAqIEBhdXRob3IgSm9uYXRoYW4gRWl0ZW4gam9uYXRoYW5Ab3BlbmZpbi5jb21cbiAqXG4gKiBAZGVzYyBTZWUge0B0dXRvcmlhbCBDUUx9IGZvciB0aGUgZ3JhbW1hci5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gb3BlcmF0b3JzSGFzaCAtIEhhc2ggb2YgdmFsaWQgb3BlcmF0b3JzLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHttZW51SXRlbVtdfSBbb3B0aW9ucy5zY2hlbWFdIC0gQ29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIG5hbWUvYWxpYXMgdmFsaWRhdGlvbi4gVGhyb3dzIGFuIGVycm9yIGlmIG5hbWUgZmFpbHMgdmFsaWRhdGlvbiAoYnV0IHNlZSBgcmVzb2x2ZUFsaWFzZXNgKS4gT21pdCB0byBza2lwIGNvbHVtbiBuYW1lIHZhbGlkYXRpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlZmF1bHRPcD0nPSddIC0gRGVmYXVsdCBvcGVyYXRvciBmb3IgY29sdW1uIHdoZW4gbm90IGRlZmluZWQgaW4gY29sdW1uIHNjaGVtYS5cbiAqL1xuZnVuY3Rpb24gUGFyc2VyQ1FMKG9wZXJhdG9yc0hhc2gsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3BlcmF0b3JzID0gW107XG5cbiAgICB0aGlzLnNjaGVtYSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zY2hlbWE7XG4gICAgdGhpcy5kZWZhdWx0T3AgPSAob3B0aW9ucyAmJiBvcHRpb25zLmRlZmF1bHRPcCB8fCAnPScpLnRvVXBwZXJDYXNlKCk7XG5cbiAgICBfKG9wZXJhdG9yc0hhc2gpLmVhY2goZnVuY3Rpb24ocHJvcHMsIG9wKSB7XG4gICAgICAgIGlmIChvcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9wZXJhdG9ycy5wdXNoKG9wKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUHV0IGxhcmdlciBvbmVzIGZpcnN0IHNvIHRoYXQgaW4gY2FzZSBhIHNtYWxsZXIgb25lIGlzIGEgc3Vic3RyaW5nIG9mIGEgbGFyZ2VyIG9uZSAoc3VjaCBhcyAnPCcgaXMgdG8gJzw9JyksIGxhcmdlciBvbmUgd2lsbCBiZSBtYXRjaGVkIGZpcnN0LlxuICAgIG9wZXJhdG9ycyA9IG9wZXJhdG9ycy5zb3J0KGRlc2NlbmRpbmdCeUxlbmd0aCk7XG5cbiAgICAvLyBFc2NhcGUgYWxsIHN5bWJvbGljIChub24gYWxwaGEpIG9wZXJhdG9ycy5cbiAgICBvcGVyYXRvcnMgPSBvcGVyYXRvcnMubWFwKGZ1bmN0aW9uKG9wKSB7XG4gICAgICAgIGlmICgvXlteQS1aXS8udGVzdChvcCkpIHtcbiAgICAgICAgICAgIG9wID0gJ1xcXFwnICsgb3Auc3BsaXQoJycpLmpvaW4oJ1xcXFwnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3A7XG4gICAgfSk7XG5cbiAgICB2YXIgc3ltYm9saWNPcGVyYXRvcnMgPSBvcGVyYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKG9wKSB7IHJldHVybiBvcFswXSA9PT0gJ1xcXFwnOyB9KSxcbiAgICAgICAgYWxwaGFPcGVyYXRvcnMgPSBvcGVyYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKG9wKSB7IHJldHVybiBvcFswXSAhPT0gJ1xcXFwnOyB9KS5qb2luKCd8Jyk7XG5cbiAgICBpZiAoYWxwaGFPcGVyYXRvcnMpIHtcbiAgICAgICAgYWxwaGFPcGVyYXRvcnMgPSAnXFxcXGIoJyArIGFscGhhT3BlcmF0b3JzICsgJylcXFxcYic7XG4gICAgfVxuICAgIC8qKiBAc3VtbWFyeSBSZWdleCB0byBtYXRjaCBhbnkgb3BlcmF0b3IuXG4gICAgICogQGRlc2MgTWF0Y2hlcyBzeW1ib2xpYyBvcGVyYXRvcnMgKG1hZGUgdXAgb2Ygbm9uLWFscGhhIGNoYXJhY3RlcnMpIG9yIGlkZW50aWZpZXIgb3BlcmF0b3JzICh3b3JkLWJvdW5kYXJ5LWlzb2xhdGVkIHJ1bnMgb2YgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMpLlxuICAgICAqIEB0eXBlIHtSZWdFeHB9XG4gICAgICovXG4gICAgdGhpcy5SRUdFWF9PUEVSQVRPUiA9IG5ldyBSZWdFeHAoc3ltYm9saWNPcGVyYXRvcnMuY29uY2F0KGFscGhhT3BlcmF0b3JzKS5qb2luKCd8JyksICdpZycpO1xuXG4gICAgb3BlcmF0b3JzID0gb3BlcmF0b3JzLmpvaW4oJ3wnKSAvLyBwaXBlIHRoZW1cbiAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJ1xcXFxzKycpOyAvLyBhcmJpdHJhcnkgc3RyaW5nIG9mIHdoaXRlc3BhY2UgY2hhcnMgLT4gd2hpdGVzcGFjZSByZWdleCBtYXRjaGVyXG5cbiAgICAvKiogQHN1bW1hcnkgUmVnZXggdG8gbWF0Y2ggYW4gb3BlcmF0b3IgKyBvcHRpb25hbCBvcGVyYXRvclxuICAgICAqIEBkZXNjIFRIZSBvcGVyYXRvciBpcyBvcHRpb25hbC4gVGhlIG9wZXJhbmQgbWF5IChvciBtYXkgbm90KSBiZSBlbmNsb3NlZCBpbiBwYXJlbnRoZXNlcy5cbiAgICAgKiBAZGVzYyBNYXRjaCBsaXN0OlxuICAgICAqIDAuIF9pbnB1dCBzdHJpbmdfXG4gICAgICogMS4gb3BlcmF0b3JcbiAgICAgKiAyLiBvdXRlciBvcGVyYW5kIChtYXkgaW5jbHVkZSBwYXJlbnRoZXNlcylcbiAgICAgKiAzLiBpbm5lciBvcGVyYW5kIHdpdGhvdXQgcGFyZW50aGVzZXMgKHdoZW4gYW4gb3BlcmFuZCB3YXMgZ2l2ZW4gd2l0aCBwYXJlbnRoZXNlcylcbiAgICAgKiA0LiBpbm5lciBvcGVyYW5kICh3aGVuIGFuIG9wZXJhbmQgd2FzIGdpdmVuIHdpdGhvdXQgcGFyZW50aGVzZXMpXG4gICAgICogQHR5cGUge1JlZ0V4cH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBtZW1iZXJPZiBQYXJzZXJDUUwucHJvdG90eXBlXG4gICAgICovXG4gICAgdGhpcy5SRUdFWF9FWFBSRVNTSU9OID0gbmV3IFJlZ0V4cCgnXlxcXFxzKignICsgb3BlcmF0b3JzICsgJyk/XFxcXHMqKFxcXFwoXFxcXHMqKC4rPylcXFxccypcXFxcKXwoLis/KSlcXFxccyokJywgJ2knKTtcblxuICAgIHRoaXMuUkVHRVhfTElURVJBTF9UT0tFTlMgPSBuZXcgUmVnRXhwKCdcXFxcJyArIFBhcnNlckNRTC5xdCArICcoXFxcXGQrKScgKyAnXFxcXCcgKyBQYXJzZXJDUUwucXQsICdnJyk7XG5cbn1cblxuLyoqIEBzdW1tYXJ5IE9wZXJhbmQgcXVvdGF0aW9uIG1hcmsgY2hhcmFjdGVyLlxuICogQGRlc2MgU2hvdWxkIGJlIGEgc2luZ2xlIGNoYXJhY3RlciAobGVuZ3RoID09PSAxKS5cbiAqIEBkZWZhdWx0ICdcIidcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblBhcnNlckNRTC5xdCA9ICdcIic7XG5cblBhcnNlckNRTC5wcm90b3R5cGUgPSB7XG5cbiAgICBjb25zdHJ1Y3RvcjogUGFyc2VyQ1FMLnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEV4dHJhY3QgdGhlIGJvb2xlYW4gb3BlcmF0b3JzIGZyb20gYW4gZXhwcmVzc2lvbiBjaGFpbi5cbiAgICAgKiBAZGVzYyBSZXR1cm5zIGxpc3Qgb2YgaG9tb2dlbmVvdXMgb3BlcmF0b3JzIHRyYW5zZm9ybWVkIHRvIGxvd2VyIGNhc2UuXG4gICAgICpcbiAgICAgKiBUaHJvd3MgYW4gZXJyb3IgaWYgYWxsIHRoZSBib29sZWFuIG9wZXJhdG9ycyBpbiB0aGUgY2hhaW4gYXJlIG5vdCBpZGVudGljYWwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNxbFxuICAgICAqIEByZXR1cm5zIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBjYXB0dXJlQm9vbGVhbnM6IGZ1bmN0aW9uKGNxbCkge1xuICAgICAgICB2YXIgYm9vbGVhbnMgPSBjcWwubWF0Y2goUkVHRVhQX0JPT0xTKTtcbiAgICAgICAgcmV0dXJuIGJvb2xlYW5zICYmIGJvb2xlYW5zLm1hcChmdW5jdGlvbihib29sKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9vbC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgdmFsaWRhdGVCb29sZWFuczogZnVuY3Rpb24oYm9vbGVhbnMpIHtcbiAgICAgICAgaWYgKGJvb2xlYW5zKSB7XG4gICAgICAgICAgICB2YXIgaGV0ZXJvZ2VuZW91c09wZXJhdG9yID0gYm9vbGVhbnMuZmluZChmdW5jdGlvbihvcCwgaSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBib29sZWFuc1tpXSAhPT0gYm9vbGVhbnNbMF07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKGhldGVyb2dlbmVvdXNPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJDcWxFcnJvcignRXhwZWN0ZWQgaG9tb2dlbmVvdXMgYm9vbGVhbiBvcGVyYXRvcnMuIFlvdSBjYW5ub3QgbWl4IEFORCwgT1IsIGFuZCBOT1Igb3BlcmF0b3JzIGhlcmUgYmVjYXVzZSB0aGUgb3JkZXIgb2Ygb3BlcmF0aW9ucyBpcyBhbWJpZ3VvdXMuXFxuVGlwOiBJbiBNYW5hZ2UgRmlsdGVycywgeW91IGNhbiBncm91cCBvcGVyYXRpb25zIHdpdGggc3ViZXhwcmVzc2lvbnMgaW4gdGhlIFF1ZXJ5IEJ1aWxkZXIgdGFiIG9yIGJ5IHVzaW5nIHBhcmVudGhlc2VzIGluIHRoZSBTUUwgdGFiLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBib29sZWFucztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQnJlYWsgYW4gZXhwcmVzc2lvbiBjaGFpbiBpbnRvIGEgbGlzdCBvZiBleHByZXNzaW9ucy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY3FsXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gYm9vbGVhbnNcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119XG4gICAgICovXG4gICAgY2FwdHVyZUV4cHJlc3Npb25zOiBmdW5jdGlvbihjcWwsIGJvb2xlYW5zKSB7XG4gICAgICAgIHZhciBleHByZXNzaW9ucywgcmU7XG5cbiAgICAgICAgaWYgKGJvb2xlYW5zKSB7XG4gICAgICAgICAgICByZSA9IG5ldyBSZWdFeHAoUFJFRklYICsgYm9vbGVhbnMuam9pbihJTkZJWCkgKyBQT1NURklYLCAnaScpO1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMgPSBjcWwubWF0Y2gocmUpO1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMuc2hpZnQoKTsgLy8gZGlzY2FyZCBbMF0gKGlucHV0KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMgPSBbY3FsXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByZXNzaW9ucztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgTWFrZSBhIGxpc3Qgb2YgY2hpbGRyZW4gb3V0IG9mIGEgbGlzdCBvZiBleHByZXNzaW9ucy5cbiAgICAgKiBAZGVzYyBVc2VzIG9ubHkgX2NvbXBsZXRlXyBleHByZXNzaW9ucyAoYSB2YWx1ZSBPUiBhbiBvcGVyYXRvciArIGEgdmFsdWUpLlxuICAgICAqXG4gICAgICogSWdub3JlcyBfaW5jb21wbGV0ZV8gZXhwcmVzc2lvbnMgKGVtcHR5IHN0cmluZyBPUiBhbiBvcGVyYXRvciAtIGEgdmFsdWUpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBleHByZXNzaW9uc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGxpdGVyYWxzIC0gbGlzdCBvZiBsaXRlcmFscyBpbmRleGVkIGJ5IHRva2VuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7ZXhwcmVzc2lvblN0YXRlW119IHdoZXJlIGBleHByZXNzaW9uU3RhdGVgIGlzIG9uZSBvZjpcbiAgICAgKiAqIGB7Y29sdW1uOiBzdHJpbmcsIG9wZXJhdG9yOiBzdHJpbmcsIG9wZXJhbmQ6IHN0cmluZ31gXG4gICAgICogKiBge2NvbHVtbjogc3RyaW5nLCBvcGVyYXRvcjogc3RyaW5nLCBvcGVyYW5kOiBzdHJpbmcsIGVkaXRvcjogJ0NvbHVtbnMnfWBcbiAgICAgKi9cbiAgICBtYWtlQ2hpbGRyZW46IGZ1bmN0aW9uKGNvbHVtbk5hbWUsIGV4cHJlc3Npb25zLCBsaXRlcmFscykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHJldHVybiBleHByZXNzaW9ucy5yZWR1Y2UoZnVuY3Rpb24oY2hpbGRyZW4sIGV4cCkge1xuICAgICAgICAgICAgaWYgKGV4cCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IGV4cC5tYXRjaChzZWxmLlJFR0VYX0VYUFJFU1NJT04pO1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0cykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3AgPSBwYXJ0c1sxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dGVyTGl0ZXJhbCA9IHBhcnRzWzJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJMaXRlcmFsID0gcGFydHMuc2xpY2UoMykuZmluZChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcnQgIT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIG9wID0gKG9wIHx8ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmVudGhlc2l6ZWQgPSAvXlxcKC4qXFwpJC8udGVzdChvdXRlckxpdGVyYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJPcGVyYXRvcnMgPSBpbm5lckxpdGVyYWwubWF0Y2goc2VsZi5SRUdFWF9PUEVSQVRPUik7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnRoZXNpemVkICYmIGlubmVyT3BlcmF0b3JzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3AgPT09ICcnICYmIG91dGVyTGl0ZXJhbCA9PT0gaW5uZXJPcGVyYXRvcnNbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyQ3FsRXJyb3IoJ0V4cGVjdGVkIGFuIG9wZXJhbmQuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJDcWxFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgb3BlcmFuZCBidXQgZm91bmQgYWRkaXRpb25hbCBvcGVyYXRvcihzKTogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJPcGVyYXRvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RyaW5nKCkgLy8gY29udmVydCB0byBjb21tYS1zZXBhcmF0ZWQgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudG9VcHBlckNhc2UoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvLC9nLCAnLCAnKSAvLyBhZGQgc3BhY2VzIGFmdGVyIHRoZSBjb21tYXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL14oW14sXSspLCAoW14sXSspJC8sICckMSBhbmQgJDInKSAvLyByZXBsYWNlIG9ubHkgY29tbWEgd2l0aCBcImFuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oLissLispLCAoW14sXSspJC8sICckMSwgYW5kICQyJykgLy8gYWRkIFwiYW5kXCIgYWZ0ZXIgbGFzdCBvZiBzZXZlcmFsIGNvbW1hc1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wID0gb3AgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2NoZW1hICYmIHNlbGYuc2NoZW1hLmxvb2t1cChjb2x1bW5OYW1lKS5kZWZhdWx0T3AgfHwgLy8gY29sdW1uJ3MgZGVmYXVsdCBvcGVyYXRvciBmcm9tIHNjaGVtYVxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5kZWZhdWx0T3A7IC8vIGdyaWQncyBkZWZhdWx0IG9wZXJhdG9yXG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBjb2x1bW5OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3BlcmF0b3I6IG9wXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpZWxkTmFtZSA9IHNlbGYuc2NoZW1hICYmIHNlbGYuc2NoZW1hLmxvb2t1cChpbm5lckxpdGVyYWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGROYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5vcGVyYW5kID0gZmllbGROYW1lLm5hbWUgfHwgZmllbGROYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQuZWRpdG9yID0gJ0NvbHVtbnMnO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBhbmQgZXhwYW5kIGFsbCBjb2xsYXBzZWQgbGl0ZXJhbHMuXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5vcGVyYW5kID0gaW5uZXJMaXRlcmFsLnJlcGxhY2Uoc2VsZi5SRUdFWF9MSVRFUkFMX1RPS0VOUywgZnVuY3Rpb24obWF0Y2gsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxpdGVyYWxzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBbXSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFRoZSBwb3NpdGlvbiBvZiB0aGUgb3BlcmF0b3Igb2YgdGhlIGV4cHJlc3Npb24gdW5kZXIgdGhlIGN1cnNvci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY3FsIC0gQ1FMIGV4cHJlc3Npb24gdW5kZXIgY29uc3RydWN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdXJzb3IgLSBDdXJyZW50IGN1cnNvcidzIHN0YXJ0aW5nIHBvc2l0aW9uIChgaW5wdXQuc3RhcnRTZWxlY3Rpb25gKVxuICAgICAqIEByZXR1cm5zIHt7c3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXJ9fVxuICAgICAqL1xuICAgIGdldE9wZXJhdG9yUG9zaXRpb246IGZ1bmN0aW9uKGNxbCwgY3Vyc29yKSB7XG4gICAgICAgIC8vIGZpcnN0IHRva2VuaXplIGxpdGVyYWxzIGluIGNhc2UgdGhleSBjb250YWluIGJvb2xlYW5zLi4uXG4gICAgICAgIHZhciBsaXRlcmFscyA9IFtdO1xuICAgICAgICBjcWwgPSB0b2tlbml6ZUxpdGVyYWxzKGNxbCwgUGFyc2VyQ1FMLnF0LCBsaXRlcmFscyk7XG5cbiAgICAgICAgLy8gLi4udGhlbiBleHBhbmQgdG9rZW5zIGJ1dCB3aXRoIHgncyBqdXN0IGZvciBsZW5ndGhcbiAgICAgICAgY3FsID0gY3FsLnJlcGxhY2UodGhpcy5SRUdFWF9MSVRFUkFMX1RPS0VOUywgZnVuY3Rpb24obWF0Y2gsIGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgbGVuZ3RoID0gMSArIGxpdGVyYWxzW2luZGV4XS5sZW5ndGggKyAxOyAvLyBhZGQgcXVvdGUgY2hhcnNcbiAgICAgICAgICAgIHJldHVybiBBcnJheShsZW5ndGggKyAxKS5qb2luKCd4Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBib29sZWFucywgZXhwcmVzc2lvbnMsIHBvc2l0aW9uLCB0YWJzLCBlbmQsIHRhYiwgZXhwcmVzc2lvbiwgb2xkT3BlcmF0b3IsIG9sZE9wZXJhdG9yT2Zmc2V0O1xuXG4gICAgICAgIGlmICgoYm9vbGVhbnMgPSB0aGlzLmNhcHR1cmVCb29sZWFucyhjcWwpKSkge1xuICAgICAgICAgICAgLy8gYm9vbGVhbihzKSBmb3VuZCBzbyBjb25jYXRlbmF0ZWQgZXhwcmVzc2lvbnNcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gdGhpcy5jYXB0dXJlRXhwcmVzc2lvbnMoY3FsLCBib29sZWFucyk7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICB0YWJzID0gZXhwcmVzc2lvbnMubWFwKGZ1bmN0aW9uKGV4cHIsIGlkeCkgeyAvLyBnZXQgc3RhcnRpbmcgcG9zaXRpb24gb2YgZWFjaCBleHByZXNzaW9uXG4gICAgICAgICAgICAgICAgdmFyIGJvb2wgPSBib29sZWFuc1tpZHggLSAxXSB8fCAnJztcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiArPSBleHByLmxlbmd0aCArIGJvb2wubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3NpdGlvbjtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBmaW5kIGJlZ2lubmluZyBvZiBleHByZXNzaW9uIHVuZGVyIGN1cnNvciBwb3NpdGlvblxuICAgICAgICAgICAgdGFicy5maW5kKGZ1bmN0aW9uKHRpY2ssIGlkeCkge1xuICAgICAgICAgICAgICAgIHRhYiA9IGlkeDtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yIDw9IHRpY2s7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY3Vyc29yID0gdGFic1t0YWIgLSAxXSB8fCAwO1xuICAgICAgICAgICAgZW5kID0gY3Vyc29yICs9IChib29sZWFuc1t0YWIgLSAxXSB8fCAnJykubGVuZ3RoO1xuXG4gICAgICAgICAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbnNbdGFiXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGJvb2xlYW5zIG5vdCBmb3VuZCBzbyBzaW5nbGUgZXhwcmVzc2lvblxuICAgICAgICAgICAgY3Vyc29yID0gMDtcbiAgICAgICAgICAgIGVuZCA9IGNxbC5sZW5ndGg7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gY3FsO1xuICAgICAgICB9XG5cbiAgICAgICAgb2xkT3BlcmF0b3JPZmZzZXQgPSBleHByZXNzaW9uLnNlYXJjaCh0aGlzLlJFR0VYX09QRVJBVE9SKTtcbiAgICAgICAgaWYgKG9sZE9wZXJhdG9yT2Zmc2V0ID49IDApIHtcbiAgICAgICAgICAgIG9sZE9wZXJhdG9yID0gZXhwcmVzc2lvbi5tYXRjaCh0aGlzLlJFR0VYX09QRVJBVE9SKVswXTtcbiAgICAgICAgICAgIGN1cnNvciArPSBvbGRPcGVyYXRvck9mZnNldDtcbiAgICAgICAgICAgIGVuZCA9IGN1cnNvciArIG9sZE9wZXJhdG9yLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGFydDogY3Vyc29yLFxuICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgfTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgTWFrZSBhIFwibG9ja2VkXCIgc3ViZXhwcmVzc2lvbiBkZWZpbml0aW9uIG9iamVjdCBmcm9tIGFuIGV4cHJlc3Npb24gY2hhaW4uXG4gICAgICogQGRlc2MgX0xvY2tlZF8gbWVhbnMgaXQgaXMgbG9ja2VkIHRvIGEgc2luZ2xlIGZpZWxkLlxuICAgICAqXG4gICAgICogV2hlbiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGV4cHJlc3Npb24gaW4gdGhlIGNoYWluLCB0aGUgYG9wZXJhdG9yYCBpcyBvbWl0dGVkIChkZWZhdWx0cyB0byBgJ29wLWFuZCdgKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjcWwgLSBBIGNvbXBvdW5kIENRTCBleHByZXNzaW9uLCBjb25zaXN0aW5nIG9mIG9uZSBvciBtb3JlIHNpbXBsZSBleHByZXNzaW9ucyBhbGwgc2VwYXJhdGVkIGJ5IHRoZSBzYW1lIGxvZ2ljYWwgb3BlcmF0b3IpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcblxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8e29wZXJhdG9yOiBzdHJpbmcsIGNoaWxkcmVuOiBzdHJpbmdbXSwgc2NoZW1hOiBzdHJpbmdbXX19XG4gICAgICogYHVuZGVmaW5lZGAgd2hlbiB0aGVyZSBhcmUgbm8gY29tcGxldGUgZXhwcmVzc2lvbnNcbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBtb2R1bGU6Q1FMXG4gICAgICovXG4gICAgcGFyc2U6IGZ1bmN0aW9uKGNxbCwgY29sdW1uTmFtZSkge1xuICAgICAgICAvLyByZWR1Y2UgYWxsIHJ1bnMgb2Ygd2hpdGUgc3BhY2UgdG8gYSBzaW5nbGUgc3BhY2U7IHRoZW4gdHJpbVxuICAgICAgICBjcWwgPSBjcWwucmVwbGFjZSgvXFxzXFxzKy9nLCAnICcpLnRyaW0oKTtcblxuICAgICAgICB2YXIgbGl0ZXJhbHMgPSBbXTtcbiAgICAgICAgY3FsID0gdG9rZW5pemVMaXRlcmFscyhjcWwsIFBhcnNlckNRTC5xdCwgbGl0ZXJhbHMpO1xuXG4gICAgICAgIHZhciBib29sZWFucyA9IHRoaXMudmFsaWRhdGVCb29sZWFucyh0aGlzLmNhcHR1cmVCb29sZWFucyhjcWwpKSxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gdGhpcy5jYXB0dXJlRXhwcmVzc2lvbnMoY3FsLCBib29sZWFucyksXG4gICAgICAgICAgICBjaGlsZHJlbiA9IHRoaXMubWFrZUNoaWxkcmVuKGNvbHVtbk5hbWUsIGV4cHJlc3Npb25zLCBsaXRlcmFscyksXG4gICAgICAgICAgICBvcGVyYXRvciA9IGJvb2xlYW5zICYmIGJvb2xlYW5zWzBdLFxuICAgICAgICAgICAgc3RhdGU7XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICAgICAgc3RhdGUgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcicsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IGNoaWxkcmVuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAob3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5vcGVyYXRvciA9ICdvcC0nICsgb3BlcmF0b3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gZGVzY2VuZGluZ0J5TGVuZ3RoKGEsIGIpIHtcbiAgICByZXR1cm4gYi5sZW5ndGggLSBhLmxlbmd0aDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDb2xsYXBzZSBsaXRlcmFscy5cbiAqIEBkZXNjIEFsbG93cyByZXNlcnZlZCB3b3JkcyB0byBleGlzdCBpbnNpZGUgYSBxdW90ZWQgc3RyaW5nLlxuICogTGl0ZXJhbHMgYXJlIGNvbGxhcHNlZCB0byBhIHF1b3RlZCBudW1lcmljYWwgaW5kZXggaW50byB0aGUgYGxpdGVyYWxzYCBhcnJheS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gcXRcbiAqIEBwYXJhbSB7c3RyaW5nW119IGxpdGVyYWxzIC0gRW1wdHkgYXJyYXkgaW4gd2hpY2ggdG8gcmV0dXJuIGV4dHJhY3RlZCBsaXRlcmFscy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAbWVtYmVyT2YgUGFyc2VyQ1FMXG4gKiBAaW5uZXJcbiAqL1xuZnVuY3Rpb24gdG9rZW5pemVMaXRlcmFscyh0ZXh0LCBxdCwgbGl0ZXJhbHMpIHtcbiAgICBsaXRlcmFscy5sZW5ndGggPSAwO1xuXG4gICAgZm9yIChcbiAgICAgICAgdmFyIGkgPSAwLCBqID0gMCwgaywgaW5uZXJMaXRlcmFsO1xuICAgICAgICAoaiA9IHRleHQuaW5kZXhPZihxdCwgaikpID49IDA7XG4gICAgICAgIGogKz0gMSArIChpICsgJycpLmxlbmd0aCArIDEsIGkrK1xuICAgICkge1xuICAgICAgICBrID0gajtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgayA9IHRleHQuaW5kZXhPZihxdCwgayArIDEpO1xuICAgICAgICAgICAgaWYgKGsgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlckNxbEVycm9yKCdRdW90YXRpb24gbWFya3MgbXVzdCBiZSBwYWlyZWQ7IG5lc3RlZCBxdW90YXRpb24gbWFya3MgbXVzdCBiZSBkb3VibGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IHdoaWxlICh0ZXh0Wysra10gPT09IHF0KTtcblxuICAgICAgICBpbm5lckxpdGVyYWwgPSB0ZXh0XG4gICAgICAgICAgICAuc2xpY2UoKytqLCAtLWspIC8vIGV4dHJhY3RcbiAgICAgICAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAocXQgKyBxdCwgJ2cnKSwgcXQpOyAvLyB1bmVzY2FwZSBlc2NhcGVkIHF1b3RhdGlvbiBtYXJrc1xuXG4gICAgICAgIGxpdGVyYWxzLnB1c2goaW5uZXJMaXRlcmFsKTtcblxuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHIoMCwgaikgKyBpICsgdGV4dC5zdWJzdHIoayk7IC8vIGNvbGxhcHNlXG4gICAgfVxuXG4gICAgcmV0dXJuIHRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyc2VyQ1FMO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYGdldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFNb2RlbC5nZXRGaWx0ZXIoY29sdW1uSW5kZXhPck5hbWUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZnRlciBzZXR0aW5nIHRoZSBuZXcgZmlsdGVyIHN0YXRlLCByZWFwcGxpZXMgdGhlIGZpbHRlciB0byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gW3N0YXRlXSAtIEEgZmlsdGVyIHRyZWUgb2JqZWN0IG9yIGEgSlNPTiwgU1FMLCBvciBDUUwgc3ViZXhwcmVzc2lvbiBzdHJpbmcgdGhhdCBkZXNjcmliZXMgdGhlIGEgbmV3IHN0YXRlIGZvciB0aGUgbmFtZWQgY29sdW1uIGZpbHRlci4gVGhlIGV4aXN0aW5nIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBpcyByZXBsYWNlZCB3aXRoIGEgbmV3IG5vZGUgYmFzZWQgb24gdGhpcyBzdGF0ZS4gSWYgaXQgZG9lcyBub3QgZXhpc3QsIHRoZSBuZXcgc3ViZXhwcmVzc2lvbiBpcyBhZGRlZCB0byB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSAoYGZpbHRlci5jb2x1bW5GaWx0ZXJzYCkuXG4gICAgICpcbiAgICAgKiBJZiB1bmRlZmluZWQsIHJlbW92ZXMgdGhlIGVudGlyZSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gZnJvbSB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZS5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldEZpbHRlcjogZnVuY3Rpb24oY29sdW1uSW5kZXhPck5hbWUsIHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnNldEZpbHRlcihjb2x1bW5JbmRleE9yTmFtZSwgc3RhdGUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJzOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFNb2RlbC5nZXRGaWx0ZXJzKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXJzOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC5zZXRGaWx0ZXJzKHN0YXRlLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YU1vZGVsLmdldFRhYmxlRmlsdGVyKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kYXRhTW9kZWwuc2V0VGFibGVGaWx0ZXIoc3RhdGUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgR2V0IGEgcGFydGljdWxhciBjb2x1bW4gZmlsdGVyJ3Mgc3RhdGUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYGdldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgaXNJbmRleCA9ICFpc05hTihOdW1iZXIoY29sdW1uSW5kZXhPck5hbWUpKSxcbiAgICAgICAgICAgIGNvbHVtbk5hbWUgPSBpc0luZGV4ID8gdGhpcy5zY2hlbWFbY29sdW1uSW5kZXhPck5hbWVdLm5hbWUgOiBjb2x1bW5JbmRleE9yTmFtZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5maWx0ZXIuZ2V0Q29sdW1uRmlsdGVyU3RhdGUoY29sdW1uTmFtZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCBhIHBhcnRpY3VsYXIgY29sdW1uIGZpbHRlcidzIHN0YXRlLlxuICAgICAqIEBkZXNjIEFmdGVyIHNldHRpbmcgdGhlIG5ldyBmaWx0ZXIgc3RhdGUsIHJlYXBwbGllcyB0aGUgZmlsdGVyIHRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IGNvbHVtbkluZGV4T3JOYW1lIC0gVGhlIF9jb2x1bW4gZmlsdGVyXyB0byBzZXQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd8b2JqZWN0fSBbc3RhdGVdIC0gQSBmaWx0ZXIgdHJlZSBvYmplY3Qgb3IgYSBKU09OLCBTUUwsIG9yIENRTCBzdWJleHByZXNzaW9uIHN0cmluZyB0aGF0IGRlc2NyaWJlcyB0aGUgYSBuZXcgc3RhdGUgZm9yIHRoZSBuYW1lZCBjb2x1bW4gZmlsdGVyLiBUaGUgZXhpc3RpbmcgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGlzIHJlcGxhY2VkIHdpdGggYSBuZXcgbm9kZSBiYXNlZCBvbiB0aGlzIHN0YXRlLiBJZiBpdCBkb2VzIG5vdCBleGlzdCwgdGhlIG5ldyBzdWJleHByZXNzaW9uIGlzIGFkZGVkIHRvIHRoZSBjb2x1bW4gZmlsdGVycyBzdWJ0cmVlIChgZmlsdGVyLmNvbHVtbkZpbHRlcnNgKS5cbiAgICAgKlxuICAgICAqIElmIHVuZGVmaW5lZCwgcmVtb3ZlcyB0aGUgZW50aXJlIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBmcm9tIHRoZSBjb2x1bW4gZmlsdGVycyBzdWJ0cmVlLlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuc3ludGF4PSdDUUwnXSAtIFRoZSBzeW50YXggdG8gdXNlIHRvIGRlc2NyaWJlIHRoZSBmaWx0ZXIgc3RhdGUuIE5vdGUgdGhhdCBgc2V0RmlsdGVyYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldEZpbHRlcjogZnVuY3Rpb24oY29sdW1uSW5kZXhPck5hbWUsIHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBpc0luZGV4ID0gIWlzTmFOKE51bWJlcihjb2x1bW5JbmRleE9yTmFtZSkpLFxuICAgICAgICAgICAgY29sdW1uTmFtZSA9IGlzSW5kZXggPyB0aGlzLnNjaGVtYVtjb2x1bW5JbmRleE9yTmFtZV0ubmFtZSA6IGNvbHVtbkluZGV4T3JOYW1lO1xuXG4gICAgICAgIHRoaXMuZmlsdGVyLnNldENvbHVtbkZpbHRlclN0YXRlKGNvbHVtbk5hbWUsIHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5ncmlkLmZpcmVTeW50aGV0aWNGaWx0ZXJBcHBsaWVkRXZlbnQoKTtcbiAgICAgICAgdGhpcy5yZWluZGV4KCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJzOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbHRlci5nZXRDb2x1bW5GaWx0ZXJzU3RhdGUob3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBzdGF0ZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXJzOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmZpbHRlci5zZXRDb2x1bW5GaWx0ZXJzU3RhdGUoc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmdyaWQuZmlyZVN5bnRoZXRpY0ZpbHRlckFwcGxpZWRFdmVudCgpO1xuICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbHRlci5nZXRUYWJsZUZpbHRlclN0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSB0aGUgdGFibGUgZmlsdGVyIHN0YXRlLlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBzdGF0ZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5maWx0ZXIuc2V0VGFibGVGaWx0ZXJTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuZ3JpZC5maXJlU3ludGhldGljRmlsdGVyQXBwbGllZEV2ZW50KCk7XG4gICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgIH0sXG5cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3ludGF4PSdDUUwnXSAtIFRoZSBzeW50YXggdG8gdXNlIHRvIGRlc2NyaWJlIHRoZSBmaWx0ZXIgc3RhdGUuIE5vdGUgdGhhdCBgZ2V0RmlsdGVyYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yLmdldEZpbHRlcihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCBhIHBhcnRpY3VsYXIgY29sdW1uIGZpbHRlcidzIHN0YXRlLlxuICAgICAqIEBkZXNjIEFmdGVyIHNldHRpbmcgdGhlIG5ldyBmaWx0ZXIgc3RhdGU6XG4gICAgICogKiBSZWFwcGxpZXMgdGhlIGZpbHRlciB0byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICogKiBDYWxscyBgYmVoYXZpb3JDaGFuZ2VkKClgIHRvIHVwZGF0ZSB0aGUgZ3JpZCBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gW3N0YXRlXSAtIEEgZmlsdGVyIHRyZWUgb2JqZWN0IG9yIGEgSlNPTiwgU1FMLCBvciBDUUwgc3ViZXhwcmVzc2lvbiBzdHJpbmcgdGhhdCBkZXNjcmliZXMgdGhlIGEgbmV3IHN0YXRlIGZvciB0aGUgbmFtZWQgY29sdW1uIGZpbHRlci4gVGhlIGV4aXN0aW5nIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBpcyByZXBsYWNlZCB3aXRoIGEgbmV3IG5vZGUgYmFzZWQgb24gdGhpcyBzdGF0ZS4gSWYgaXQgZG9lcyBub3QgZXhpc3QsIHRoZSBuZXcgc3ViZXhwcmVzc2lvbiBpcyBhZGRlZCB0byB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSAoYGZpbHRlci5jb2x1bW5GaWx0ZXJzYCkuXG4gICAgICpcbiAgICAgKiBJZiB1bmRlZmluZWQsIHJlbW92ZXMgdGhlIGVudGlyZSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gZnJvbSB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZS5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICBpZiAodGhpcy5jZWxsRWRpdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxFZGl0b3IuaGlkZUVkaXRvcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYmVoYXZpb3Iuc2V0RmlsdGVyKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3JDaGFuZ2VkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJzOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yLmdldEZpbHRlcnMob3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBzdGF0ZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXJzOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICBpZiAodGhpcy5jZWxsRWRpdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxFZGl0b3IuaGlkZUVkaXRvcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYmVoYXZpb3Iuc2V0RmlsdGVycyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3JDaGFuZ2VkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5iZWhhdmlvci5nZXRUYWJsZUZpbHRlcihvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmJlaGF2aW9yLnNldFRhYmxlRmlsdGVyKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5iZWhhdmlvckNoYW5nZWQoKTtcbiAgICB9LFxuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuLyoqIEBuYW1lc3BhY2UgY3NzSW5qZWN0b3IgKi9cblxuLyoqXG4gKiBAc3VtbWFyeSBJbnNlcnQgYmFzZSBzdHlsZXNoZWV0IGludG8gRE9NXG4gKlxuICogQGRlc2MgQ3JlYXRlcyBhIG5ldyBgPHN0eWxlPi4uLjwvc3R5bGU+YCBlbGVtZW50IGZyb20gdGhlIG5hbWVkIHRleHQgc3RyaW5nKHMpIGFuZCBpbnNlcnRzIGl0IGJ1dCBvbmx5IGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QgaW4gdGhlIHNwZWNpZmllZCBjb250YWluZXIgYXMgcGVyIGByZWZlcmVuY2VFbGVtZW50YC5cbiAqXG4gKiA+IENhdmVhdDogSWYgc3R5bGVzaGVldCBpcyBmb3IgdXNlIGluIGEgc2hhZG93IERPTSwgeW91IG11c3Qgc3BlY2lmeSBhIGxvY2FsIGByZWZlcmVuY2VFbGVtZW50YC5cbiAqXG4gKiBAcmV0dXJucyBBIHJlZmVyZW5jZSB0byB0aGUgbmV3bHkgY3JlYXRlZCBgPHN0eWxlPi4uLjwvc3R5bGU+YCBlbGVtZW50LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBjc3NSdWxlc1xuICogQHBhcmFtIHtzdHJpbmd9IFtJRF1cbiAqIEBwYXJhbSB7dW5kZWZpbmVkfG51bGx8RWxlbWVudHxzdHJpbmd9IFtyZWZlcmVuY2VFbGVtZW50XSAtIENvbnRhaW5lciBmb3IgaW5zZXJ0aW9uLiBPdmVybG9hZHM6XG4gKiAqIGB1bmRlZmluZWRgIHR5cGUgKG9yIG9taXR0ZWQpOiBpbmplY3RzIHN0eWxlc2hlZXQgYXQgdG9wIG9mIGA8aGVhZD4uLi48L2hlYWQ+YCBlbGVtZW50XG4gKiAqIGBudWxsYCB2YWx1ZTogaW5qZWN0cyBzdHlsZXNoZWV0IGF0IGJvdHRvbSBvZiBgPGhlYWQ+Li4uPC9oZWFkPmAgZWxlbWVudFxuICogKiBgRWxlbWVudGAgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBlbGVtZW50LCB3aGVyZXZlciBpdCBpcyBmb3VuZC5cbiAqICogYHN0cmluZ2AgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBmaXJzdCBlbGVtZW50IGZvdW5kIHRoYXQgbWF0Y2hlcyB0aGUgZ2l2ZW4gY3NzIHNlbGVjdG9yLlxuICpcbiAqIEBtZW1iZXJPZiBjc3NJbmplY3RvclxuICovXG5mdW5jdGlvbiBjc3NJbmplY3Rvcihjc3NSdWxlcywgSUQsIHJlZmVyZW5jZUVsZW1lbnQpIHtcbiAgICBpZiAodHlwZW9mIHJlZmVyZW5jZUVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlZmVyZW5jZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHJlZmVyZW5jZUVsZW1lbnQpO1xuICAgICAgICBpZiAoIXJlZmVyZW5jZUVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRocm93ICdDYW5ub3QgZmluZCByZWZlcmVuY2UgZWxlbWVudCBmb3IgQ1NTIGluamVjdGlvbi4nO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChyZWZlcmVuY2VFbGVtZW50ICYmICEocmVmZXJlbmNlRWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICAgIHRocm93ICdHaXZlbiB2YWx1ZSBub3QgYSByZWZlcmVuY2UgZWxlbWVudC4nO1xuICAgIH1cblxuICAgIHZhciBjb250YWluZXIgPSByZWZlcmVuY2VFbGVtZW50ICYmIHJlZmVyZW5jZUVsZW1lbnQucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XG5cbiAgICBpZiAoSUQpIHtcbiAgICAgICAgSUQgPSBjc3NJbmplY3Rvci5pZFByZWZpeCArIElEO1xuXG4gICAgICAgIGlmIChjb250YWluZXIucXVlcnlTZWxlY3RvcignIycgKyBJRCkpIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gc3R5bGVzaGVldCBhbHJlYWR5IGluIERPTVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAoSUQpIHtcbiAgICAgICAgc3R5bGUuaWQgPSBJRDtcbiAgICB9XG4gICAgaWYgKGNzc1J1bGVzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgY3NzUnVsZXMgPSBjc3NSdWxlcy5qb2luKCdcXG4nKTtcbiAgICB9XG4gICAgY3NzUnVsZXMgPSAnXFxuJyArIGNzc1J1bGVzICsgJ1xcbic7XG4gICAgaWYgKHN0eWxlLnN0eWxlU2hlZXQpIHtcbiAgICAgICAgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzUnVsZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzUnVsZXMpKTtcbiAgICB9XG5cbiAgICBpZiAocmVmZXJlbmNlRWxlbWVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlZmVyZW5jZUVsZW1lbnQgPSBjb250YWluZXIuZmlyc3RDaGlsZDtcbiAgICB9XG5cbiAgICBjb250YWluZXIuaW5zZXJ0QmVmb3JlKHN0eWxlLCByZWZlcmVuY2VFbGVtZW50KTtcblxuICAgIHJldHVybiBzdHlsZTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBPcHRpb25hbCBwcmVmaXggZm9yIGA8c3R5bGU+YCB0YWcgSURzLlxuICogQGRlc2MgRGVmYXVsdHMgdG8gYCdpbmplY3RlZC1zdHlsZXNoZWV0LSdgLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBtZW1iZXJPZiBjc3NJbmplY3RvclxuICovXG5jc3NJbmplY3Rvci5pZFByZWZpeCA9ICdpbmplY3RlZC1zdHlsZXNoZWV0LSc7XG5cbi8vIEludGVyZmFjZVxubW9kdWxlLmV4cG9ydHMgPSBjc3NJbmplY3RvcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG92ZXJyaWRlciA9IHJlcXVpcmUoJ292ZXJyaWRlcicpO1xuXG4vKiogQG5hbWVzcGFjZSBleHRlbmQtbWUgKiovXG5cbi8qKiBAc3VtbWFyeSBFeHRlbmRzIGFuIGV4aXN0aW5nIGNvbnN0cnVjdG9yIGludG8gYSBuZXcgY29uc3RydWN0b3IuXG4gKlxuICogQHJldHVybnMge0NoaWxkQ29uc3RydWN0b3J9IEEgbmV3IGNvbnN0cnVjdG9yLCBleHRlbmRlZCBmcm9tIHRoZSBnaXZlbiBjb250ZXh0LCBwb3NzaWJseSB3aXRoIHNvbWUgcHJvdG90eXBlIGFkZGl0aW9ucy5cbiAqXG4gKiBAZGVzYyBFeHRlbmRzIFwib2JqZWN0c1wiIChjb25zdHJ1Y3RvcnMpLCB3aXRoIG9wdGlvbmFsIGFkZGl0aW9uYWwgY29kZSwgb3B0aW9uYWwgcHJvdG90eXBlIGFkZGl0aW9ucywgYW5kIG9wdGlvbmFsIHByb3RvdHlwZSBtZW1iZXIgYWxpYXNlcy5cbiAqXG4gKiA+IENBVkVBVDogTm90IHRvIGJlIGNvbmZ1c2VkIHdpdGggVW5kZXJzY29yZS1zdHlsZSAuZXh0ZW5kKCkgd2hpY2ggaXMgc29tZXRoaW5nIGVsc2UgZW50aXJlbHkuIEkndmUgdXNlZCB0aGUgbmFtZSBcImV4dGVuZFwiIGhlcmUgYmVjYXVzZSBvdGhlciBwYWNrYWdlcyAobGlrZSBCYWNrYm9uZS5qcykgdXNlIGl0IHRoaXMgd2F5LiBZb3UgYXJlIGZyZWUgdG8gY2FsbCBpdCB3aGF0ZXZlciB5b3Ugd2FudCB3aGVuIHlvdSBcInJlcXVpcmVcIiBpdCwgc3VjaCBhcyBgdmFyIGluaGVyaXRzID0gcmVxdWlyZSgnZXh0ZW5kJylgLlxuICpcbiAqIFByb3ZpZGUgYSBjb25zdHJ1Y3RvciBhcyB0aGUgY29udGV4dCBhbmQgYW55IHByb3RvdHlwZSBhZGRpdGlvbnMgeW91IHJlcXVpcmUgaW4gdGhlIGZpcnN0IGFyZ3VtZW50LlxuICpcbiAqIEZvciBleGFtcGxlLCBpZiB5b3Ugd2lzaCB0byBiZSBhYmxlIHRvIGV4dGVuZCBgQmFzZUNvbnN0cnVjdG9yYCB0byBhIG5ldyBjb25zdHJ1Y3RvciB3aXRoIHByb3RvdHlwZSBvdmVycmlkZXMgYW5kL29yIGFkZGl0aW9ucywgYmFzaWMgdXNhZ2UgaXM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIEJhc2UgPSByZXF1aXJlKCdleHRlbmQtbWUnKS5CYXNlO1xuICogdmFyIEJhc2VDb25zdHJ1Y3RvciA9IEJhc2UuZXh0ZW5kKGJhc2VQcm90b3R5cGUpOyAvLyBtaXhlcyBpbiAuZXh0ZW5kXG4gKiB2YXIgQ2hpbGRDb25zdHJ1Y3RvciA9IEJhc2VDb25zdHJ1Y3Rvci5leHRlbmQoY2hpbGRQcm90b3R5cGVPdmVycmlkZXNBbmRBZGRpdGlvbnMpO1xuICogdmFyIEdyYW5kY2hpbGRDb25zdHJ1Y3RvciA9IENoaWxkQ29uc3RydWN0b3IuZXh0ZW5kKGdyYW5kY2hpbGRQcm90b3R5cGVPdmVycmlkZXNBbmRBZGRpdGlvbnMpO1xuICogYGBgXG4gKlxuICogVGhpcyBmdW5jdGlvbiAoYGV4dGVuZCgpYCkgaXMgYWRkZWQgdG8gdGhlIG5ldyBleHRlbmRlZCBvYmplY3QgY29uc3RydWN0b3IgYXMgYSBwcm9wZXJ0eSBgLmV4dGVuZGAsIGVzc2VudGlhbGx5IG1ha2luZyB0aGUgb2JqZWN0IGNvbnN0cnVjdG9yIGl0c2VsZiBlYXNpbHkgXCJleHRlbmRhYmxlLlwiIChOb3RlOiBUaGlzIGlzIGEgcHJvcGVydHkgb2YgZWFjaCBjb25zdHJ1Y3RvciBhbmQgbm90IGEgbWV0aG9kIG9mIGl0cyBwcm90b3R5cGUhKVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBbZXh0ZW5kZWRDbGFzc05hbWVdIC0gVGhpcyBpcyBzaW1wbHkgYWRkZWQgdG8gdGhlIHByb3RvdHlwZSBhcyAkJENMQVNTX05BTUUuIFVzZWZ1bCBmb3IgZGVidWdnaW5nIGJlY2F1c2UgYWxsIGRlcml2ZWQgY29uc3RydWN0b3JzIGFwcGVhciB0byBoYXZlIHRoZSBzYW1lIG5hbWUgKFwiQ29uc3RydWN0b3JcIikgaW4gdGhlIGRlYnVnZ2VyLlxuICpcbiAqIEBwYXJhbSB7ZXh0ZW5kZWRQcm90b3R5cGVBZGRpdGlvbnNPYmplY3R9IFtwcm90b3R5cGVBZGRpdGlvbnNdIC0gT2JqZWN0IHdpdGggbWVtYmVycyB0byBjb3B5IHRvIG5ldyBjb25zdHJ1Y3RvcidzIHByb3RvdHlwZS5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtkZWJ1Z10gLSBTZWUgcGFyYW1ldGVyIGBleHRlbmRlZENsYXNzTmFtZWAgXyhhYm92ZSlfLlxuICpcbiAqIEBwcm9wZXJ0eSB7b2JqZWN0fSBCYXNlIC0gQSBjb252ZW5pZW50IGJhc2UgY2xhc3MgZnJvbSB3aGljaCBhbGwgb3RoZXIgY2xhc3NlcyBjYW4gYmUgZXh0ZW5kZWQuXG4gKlxuICogQG1lbWJlck9mIGV4dGVuZC1tZVxuICovXG5mdW5jdGlvbiBleHRlbmQoZXh0ZW5kZWRDbGFzc05hbWUsIHByb3RvdHlwZUFkZGl0aW9ucykge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBleHRlbmRlZENsYXNzTmFtZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgIHByb3RvdHlwZUFkZGl0aW9ucyA9IGV4dGVuZGVkQ2xhc3NOYW1lO1xuICAgICAgICAgICAgICAgICAgICBleHRlbmRlZENsYXNzTmFtZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgcHJvdG90eXBlQWRkaXRpb25zID0ge307XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRocm93ICdTaW5nbGUtcGFyYW1ldGVyIG92ZXJsb2FkIG11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4dGVuZGVkQ2xhc3NOYW1lICE9PSAnc3RyaW5nJyB8fCB0eXBlb2YgcHJvdG90eXBlQWRkaXRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHRocm93ICdUd28tcGFyYW1ldGVyIG92ZXJsb2FkIG11c3QgYmUgc3RyaW5nLCBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgJ1RvbyBtYW55IHBhcmFtZXRlcnMnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIENvbnN0cnVjdG9yKCkge1xuICAgICAgICBpZiAocHJvdG90eXBlQWRkaXRpb25zLnByZUluaXRpYWxpemUpIHtcbiAgICAgICAgICAgIHByb3RvdHlwZUFkZGl0aW9ucy5wcmVJbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpbml0aWFsaXplUHJvdG90eXBlQ2hhaW4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICBpZiAocHJvdG90eXBlQWRkaXRpb25zLnBvc3RJbml0aWFsaXplKSB7XG4gICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMucG9zdEluaXRpYWxpemUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIENvbnN0cnVjdG9yLmV4dGVuZCA9IGV4dGVuZDtcblxuICAgIHZhciBwcm90b3R5cGUgPSBDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHRoaXMucHJvdG90eXBlKTtcbiAgICBwcm90b3R5cGUuY29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcblxuICAgIGlmIChleHRlbmRlZENsYXNzTmFtZSkge1xuICAgICAgICBwcm90b3R5cGUuJCRDTEFTU19OQU1FID0gZXh0ZW5kZWRDbGFzc05hbWU7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGVyKHByb3RvdHlwZSwgcHJvdG90eXBlQWRkaXRpb25zKTtcblxuICAgIHJldHVybiBDb25zdHJ1Y3Rvcjtcbn1cblxuZnVuY3Rpb24gQmFzZSgpIHt9XG5CYXNlLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogQmFzZS5wcm90b3R5cGUuY29uc3RydWN0b3IsXG4gICAgZ2V0IHN1cGVyKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSk7XG4gICAgfVxufTtcbkJhc2UuZXh0ZW5kID0gZXh0ZW5kO1xuZXh0ZW5kLkJhc2UgPSBCYXNlO1xuXG4vKiogQHR5cGVkZWYge2Z1bmN0aW9ufSBleHRlbmRlZENvbnN0cnVjdG9yXG4gKiBAcHJvcGVydHkgcHJvdG90eXBlLnN1cGVyIC0gQSByZWZlcmVuY2UgdG8gdGhlIHByb3RvdHlwZSB0aGlzIGNvbnN0cnVjdG9yIHdhcyBleHRlbmRlZCBmcm9tLlxuICogQHByb3BlcnR5IFtleHRlbmRdIC0gSWYgYHByb3RvdHlwZUFkZGl0aW9ucy5leHRlbmRhYmxlYCB3YXMgdHJ1dGh5LCB0aGlzIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8ge0BsaW5rIGV4dGVuZC5leHRlbmR8ZXh0ZW5kfS5cbiAqL1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gZXh0ZW5kZWRQcm90b3R5cGVBZGRpdGlvbnNPYmplY3RcbiAqIEBkZXNjIEFsbCBtZW1iZXJzIGFyZSBjb3BpZWQgdG8gdGhlIG5ldyBvYmplY3QuIFRoZSBmb2xsb3dpbmcgaGF2ZSBzcGVjaWFsIG1lYW5pbmcuXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSBbaW5pdGlhbGl6ZV0gLSBBZGRpdGlvbmFsIGNvbnN0cnVjdG9yIGNvZGUgZm9yIG5ldyBvYmplY3QuIFRoaXMgbWV0aG9kIGlzIGFkZGVkIHRvIHRoZSBuZXcgY29uc3RydWN0b3IncyBwcm90b3R5cGUuIEdldHMgcGFzc2VkIG5ldyBvYmplY3QgYXMgY29udGV4dCArIHNhbWUgYXJncyBhcyBjb25zdHJ1Y3RvciBpdHNlbGYuIENhbGxlZCBvbiBpbnN0YW50aWF0aW9uIGFmdGVyIHNpbWlsYXIgZnVuY3Rpb24gaW4gYWxsIGFuY2VzdG9ycyBjYWxsZWQgd2l0aCBzYW1lIHNpZ25hdHVyZS5cbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IFtwcmVJbml0aWFsaXplXSAtIENhbGxlZCBiZWZvcmUgdGhlIGBpbml0aWFsaXplYCBjYXNjYWRlLiBHZXRzIHBhc3NlZCBuZXcgb2JqZWN0IGFzIGNvbnRleHQgKyBzYW1lIGFyZ3MgYXMgY29uc3RydWN0b3IgaXRzZWxmLlxuICogQHByb3BlcnR5IHtmdW5jdGlvbn0gW3Bvc3RJbml0aWFsaXplXSAtIENhbGxlZCBhZnRlciB0aGUgYGluaXRpYWxpemVgIGNhc2NhZGUuIEdldHMgcGFzc2VkIG5ldyBvYmplY3QgYXMgY29udGV4dCArIHNhbWUgYXJncyBhcyBjb25zdHJ1Y3RvciBpdHNlbGYuXG4gKi9cblxuLyoqIEBzdW1tYXJ5IENhbGwgYWxsIGBpbml0aWFsaXplYCBtZXRob2RzIGZvdW5kIGluIHByb3RvdHlwZSBjaGFpbiwgYmVnaW5uaW5nIHdpdGggdGhlIG1vc3Qgc2VuaW9yIGFuY2VzdG9yJ3MgZmlyc3QuXG4gKiBAZGVzYyBUaGlzIHJlY3Vyc2l2ZSByb3V0aW5lIGlzIGNhbGxlZCBieSB0aGUgY29uc3RydWN0b3IuXG4gKiAxLiBXYWxrcyBiYWNrIHRoZSBwcm90b3R5cGUgY2hhaW4gdG8gYE9iamVjdGAncyBwcm90b3R5cGVcbiAqIDIuIFdhbGtzIGZvcndhcmQgdG8gbmV3IG9iamVjdCwgY2FsbGluZyBhbnkgYGluaXRpYWxpemVgIG1ldGhvZHMgaXQgZmluZHMgYWxvbmcgdGhlIHdheSB3aXRoIHRoZSBzYW1lIGNvbnRleHQgYW5kIGFyZ3VtZW50cyB3aXRoIHdoaWNoIHRoZSBjb25zdHJ1Y3RvciB3YXMgY2FsbGVkLlxuICogQHByaXZhdGVcbiAqIEBtZW1iZXJPZiBleHRlbmQtbWVcbiAqL1xuZnVuY3Rpb24gaW5pdGlhbGl6ZVByb3RvdHlwZUNoYWluKCkge1xuICAgIHZhciB0ZXJtID0gdGhpcyxcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICByZWN1cih0ZXJtKTtcblxuICAgIGZ1bmN0aW9uIHJlY3VyKG9iaikge1xuICAgICAgICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKTtcbiAgICAgICAgaWYgKHByb3RvLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICAgICAgICAgIHJlY3VyKHByb3RvKTtcbiAgICAgICAgICAgIGlmIChwcm90by5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbGl6ZScpKSB7XG4gICAgICAgICAgICAgICAgcHJvdG8uaW5pdGlhbGl6ZS5hcHBseSh0ZXJtLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHNbJ2NvbHVtbi1DUUwtc3ludGF4J10gPSBbXG4nPGxpPicsXG4nXHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNvcHlcIj48L2J1dHRvbj4nLFxuJ1x0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2PicsXG4nXHR7MX06JyxcbidcdDxpbnB1dCBuYW1lPVwiezJ9XCIgY2xhc3M9XCJ7NH1cIiB2YWx1ZT1cInszOmVuY29kZX1cIj4nLFxuJzwvbGk+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0c1snY29sdW1uLVNRTC1zeW50YXgnXSA9IFtcbic8bGk+JyxcbidcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29weVwiPjwvYnV0dG9uPicsXG4nXHQ8ZGl2IGNsYXNzPVwiZmlsdGVyLXRyZWUtcmVtb3ZlLWJ1dHRvblwiIHRpdGxlPVwiZGVsZXRlIGNvbmRpdGlvbmFsXCI+PC9kaXY+JyxcbidcdHsxfTonLFxuJ1x0PHRleHRhcmVhIG5hbWU9XCJ7Mn1cIiByb3dzPVwiMVwiIGNsYXNzPVwiezR9XCI+ezM6ZW5jb2RlfTwvdGV4dGFyZWE+Jyxcbic8L2xpPidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMuY29sdW1uRmlsdGVyID0gW1xuJzxzcGFuIGNsYXNzPVwiZmlsdGVyLXRyZWVcIj4nLFxuJ1x0IDxzdHJvbmc+PHNwYW4+ezJ9IDwvc3Bhbj5jb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb246PC9zdHJvbmc+PGJyPicsXG4nXHQgTWF0Y2gnLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbidcdCA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3AtYW5kXCI+YWxsPC9sYWJlbD4nLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1ub3JcIj5ub25lPC9sYWJlbD4nLFxuJ1x0IG9mIHRoZSBmb2xsb3dpbmc6JyxcbidcdCA8c2VsZWN0PicsXG4nXHRcdCA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4nXHQgPC9zZWxlY3Q+JyxcbidcdCA8b2w+PC9vbD4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5jb2x1bW5GaWx0ZXJzID0gW1xuJzxzcGFuIGNsYXNzPVwiZmlsdGVyLXRyZWUgZmlsdGVyLXRyZWUtdHlwZS1jb2x1bW4tZmlsdGVyc1wiPicsXG4nXHQgTWF0Y2ggPHN0cm9uZz5hbGw8L3N0cm9uZz4gb2YgdGhlIGZvbGxvd2luZyBjb2x1bW4gZmlsdGVyczonLFxuJ1x0IDxvbD48L29sPicsXG4nIDwvc3Bhbj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLmxvY2tlZENvbHVtbiA9IFtcbic8c3Bhbj4nLFxuJ1x0IHsxOmVuY29kZX0nLFxuJ1x0IDxpbnB1dCB0eXBlPVwiaGlkZGVuXCIgdmFsdWU9XCJ7Mn1cIj4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5ub3RlID0gW1xuJzxkaXYgY2xhc3M9XCJmb290bm90ZXNcIj4nLFxuJ1x0PGRpdiBjbGFzcz1cImZvb3Rub3RlXCI+PC9kaXY+JyxcbidcdDxwPlNlbGVjdCBhIG5ldyB2YWx1ZSBvciBkZWxldGUgdGhlIGV4cHJlc3Npb24gYWx0b2dldGhlci48L3A+Jyxcbic8L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLm5vdGVzID0gW1xuJzxkaXYgY2xhc3M9XCJmb290bm90ZXNcIj4nLFxuJ1x0PHA+Tm90ZSB0aGUgZm9sbG93aW5nIGVycm9yIGNvbmRpdGlvbnM6PC9wPicsXG4nXHQ8dWwgY2xhc3M9XCJmb290bm90ZVwiPjwvdWw+JyxcbidcdDxwPlNlbGVjdCBuZXcgdmFsdWVzIG9yIGRlbGV0ZSB0aGUgZXhwcmVzc2lvbiBhbHRvZ2V0aGVyLjwvcD4nLFxuJzwvZGl2Pidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMub3B0aW9uTWlzc2luZyA9IFtcbidUaGUgcmVxdWVzdGVkIHZhbHVlIG9mIDxzcGFuIGNsYXNzPVwiZmllbGQtbmFtZVwiPnsxOmVuY29kZX08L3NwYW4+JyxcbicoPHNwYW4gY2xhc3M9XCJmaWVsZC12YWx1ZVwiPnsyOmVuY29kZX08L3NwYW4+KSBpcyBub3QgdmFsaWQuJ1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5yZW1vdmVCdXR0b24gPSBbXG4nPGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2Pidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMuc3VidHJlZSA9IFtcbic8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbidcdCBNYXRjaCcsXG4nXHQgPGxhYmVsPjxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImZpbHRlci10cmVlLW9wLWNob2ljZVwiIG5hbWU9XCJ0cmVlT3B7MX1cIiB2YWx1ZT1cIm9wLW9yXCI+YW55PC9sYWJlbD4nLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1hbmRcIj5hbGw8L2xhYmVsPicsXG4nXHQgPGxhYmVsPjxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImZpbHRlci10cmVlLW9wLWNob2ljZVwiIG5hbWU9XCJ0cmVlT3B7MX1cIiB2YWx1ZT1cIm9wLW5vclwiPm5vbmU8L2xhYmVsPicsXG4nXHQgb2YgdGhlIGZvbGxvd2luZzonLFxuJ1x0IDxzZWxlY3Q+JyxcbidcdFx0IDxvcHRpb24gdmFsdWU9XCJcIj5OZXcgZXhwcmVzc2lvbiZoZWxsaXA7PC9vcHRpb24+JyxcbidcdFx0IDxvcHRpb24gdmFsdWU9XCJzdWJleHBcIiBzdHlsZT1cImJvcmRlci1ib3R0b206MXB4IHNvbGlkIGJsYWNrXCI+U3ViZXhwcmVzc2lvbjwvb3B0aW9uPicsXG4nXHQgPC9zZWxlY3Q+JyxcbidcdCA8b2w+PC9vbD4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBGaWx0ZXJUcmVlID0gcmVxdWlyZSgnLi9qcy9GaWx0ZXJUcmVlJyk7XG5GaWx0ZXJUcmVlLk5vZGUgPSByZXF1aXJlKCcuL2pzL0ZpbHRlck5vZGUnKTsgLy8gYWthOiBPYmplY3QuZ2V0UHJvdG90eXBlT2YoRmlsdGVyVHJlZS5wcm90b3R5cGUpLmNvbnN0cnVjdG9yXG5GaWx0ZXJUcmVlLkxlYWYgPSByZXF1aXJlKCcuL2pzL0ZpbHRlckxlYWYnKTsgLy8gYWthOiBGaWx0ZXJUcmVlLnByb3RvdHlwZS5lZGl0b3JzLkRlZmF1bHRcblxuLy8gZXhwb3NlIHNvbWUgb2JqZWN0cyBmb3IgcGx1Zy1pbiBhY2Nlc3NcblxuRmlsdGVyVHJlZS5Db25kaXRpb25hbHMgPSByZXF1aXJlKCcuL2pzL0NvbmRpdGlvbmFscycpO1xuXG4vLyBGT0xMT1dJTkcgUFJPUEVSVElFUyBBUkUgKioqIFRFTVBPUkFSWSAqKiosXG4vLyBGT1IgVEhFIERFTU8gVE8gQUNDRVNTIFRIRVNFIE5PREUgTU9EVUxFUy5cblxuRmlsdGVyVHJlZS5fID0gXztcbkZpbHRlclRyZWUucG9wTWVudSA9IHBvcE1lbnU7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJUcmVlO1xuIiwiLyoqIEBtb2R1bGUgY29uZGl0aW9uYWxzICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEJhc2UgPSByZXF1aXJlKCdleHRlbmQtbWUnKS5CYXNlO1xudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgcmVnRXhwTElLRSA9IHJlcXVpcmUoJ3JlZ2V4cC1saWtlJyk7XG5cbnZhciBJTiA9ICdJTicsXG4gICAgTk9UX0lOID0gJ05PVCAnICsgSU4sXG4gICAgTElLRSA9ICdMSUtFJyxcbiAgICBOT1RfTElLRSA9ICdOT1QgJyArIExJS0UsXG4gICAgTElLRV9XSUxEX0NBUkQgPSAnJScsXG4gICAgTklMID0gJyc7XG5cbnZhciB0b1N0cmluZztcblxudmFyIGRlZmF1bHRJZFF0cyA9IHtcbiAgICBiZWc6ICdcIicsXG4gICAgZW5kOiAnXCInXG59O1xuXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBDb25kaXRpb25hbHMgPSBCYXNlLmV4dGVuZCh7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzcWxJZFF0c09iamVjdH0gW29wdGlvbnMuc3FsSWRRdHM9e2JlZzonXCInLGVuZDonXCInfV1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGlkUXRzID0gb3B0aW9ucyAmJiBvcHRpb25zLnNxbElkUXRzO1xuICAgICAgICBpZiAoaWRRdHMpIHtcbiAgICAgICAgICAgIHRoaXMuc3FsSWRRdHMgPSBpZFF0czsgLy8gb25seSBvdmVycmlkZSBpZiBkZWZpbmVkXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc3FsSWRRdHM6IGRlZmF1bHRJZFF0cyxcbiAgICAvKipcbiAgICAgKiBAcGFyYW0gaWRcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZVNxbElkZW50aWZpZXI6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNxbElkUXRzLmJlZyArIGlkICsgdGhpcy5zcWxJZFF0cy5lbmQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBzdHJpbmdcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZVNxbFN0cmluZzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiAnXFwnJyArIHNxRXNjKHN0cmluZykgKyAnXFwnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlTElLRTogZnVuY3Rpb24oYmVnLCBlbmQsIG9wLCBvcmlnaW5hbE9wLCBjKSB7XG4gICAgICAgIHZhciBlc2NhcGVkID0gYy5vcGVyYW5kLnJlcGxhY2UoLyhbX1xcW1xcXSVdKS9nLCAnWyQxXScpOyAvLyBlc2NhcGUgYWxsIExJS0UgcmVzZXJ2ZWQgY2hhcnNcbiAgICAgICAgcmV0dXJuIHRoaXMubWFrZVNxbElkZW50aWZpZXIoYy5jb2x1bW4pICtcbiAgICAgICAgICAgICcgJyArIG9wICtcbiAgICAgICAgICAgICcgJyArIHRoaXMubWFrZVNxbFN0cmluZyhiZWcgKyBlc2NhcGVkICsgZW5kKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlSU46IGZ1bmN0aW9uKG9wLCBjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ha2VTcWxJZGVudGlmaWVyKGMuY29sdW1uKSArXG4gICAgICAgICAgICAnICcgKyBvcCArXG4gICAgICAgICAgICAnICcgKyAnKFxcJycgKyBzcUVzYyhjLm9wZXJhbmQpLnJlcGxhY2UoL1xccyosXFxzKi9nLCAnXFwnLCBcXCcnKSArICdcXCcpJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlOiBmdW5jdGlvbihvcCwgYykge1xuICAgICAgICByZXR1cm4gdGhpcy5tYWtlU3FsSWRlbnRpZmllcihjLmNvbHVtbikgK1xuICAgICAgICAgICAgJyAnICsgb3AgK1xuICAgICAgICAgICAgJyAnICsgYy5tYWtlU3FsT3BlcmFuZCgpO1xuICAgIH1cbn0pO1xuXG52YXIgb3BzID0gQ29uZGl0aW9uYWxzLnByb3RvdHlwZS5vcHMgPSB7XG4gICAgdW5kZWZpbmVkOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oKSB7IHJldHVybiAnJzsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc8Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhIDwgYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKCc8JywgYyk7IH1cbiAgICB9LFxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJzw9Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhIDw9IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZSgnPD0nLCBjKTsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc9Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhID09PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJz0nLCBjKTsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc+PSc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA+PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJz49JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnPic6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA+IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZSgnPicsIGMpOyB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJzw+Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhICE9PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJzw+JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBMSUtFOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIHJlZ0V4cExJS0UuY2FjaGVkKGIsIHRydWUpLnRlc3QoYSk7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZShMSUtFLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIExJS0UnOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuICFyZWdFeHBMSUtFLmNhY2hlZChiLCB0cnVlKS50ZXN0KGEpOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoTk9UX0xJS0UsIGMpOyB9LFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIElOOiB7IC8vIFRPRE86IGN1cnJlbnRseSBmb3JjaW5nIHN0cmluZyB0eXBpbmc7IHJld29yayBjYWxsaW5nIGNvZGUgdG8gcmVzcGVjdCBjb2x1bW4gdHlwZVxuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBpbk9wKGEsIGIpID49IDA7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUlOKElOLCBjKTsgfSxcbiAgICAgICAgb3BlcmFuZExpc3Q6IHRydWUsXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBJTic6IHsgLy8gVE9ETzogY3VycmVudGx5IGZvcmNpbmcgc3RyaW5nIHR5cGluZzsgcmV3b3JrIGNhbGxpbmcgY29kZSB0byByZXNwZWN0IGNvbHVtbiB0eXBlXG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGluT3AoYSwgYikgPCAwOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VJTihOT1RfSU4sIGMpOyB9LFxuICAgICAgICBvcGVyYW5kTGlzdDogdHJ1ZSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBDT05UQUlOUzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBjb250YWluc09wKGEsIGIpID49IDA7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIExJS0VfV0lMRF9DQVJELCBMSUtFLCAnQ09OVEFJTlMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIENPTlRBSU5TJzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBjb250YWluc09wKGEsIGIpIDwgMDsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlTElLRShMSUtFX1dJTERfQ0FSRCwgTElLRV9XSUxEX0NBUkQsIE5PVF9MSUtFLCAnTk9UIENPTlRBSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgQkVHSU5TOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgYiA9IHRvU3RyaW5nKGIpOyByZXR1cm4gYmVnaW5zT3AoYSwgYi5sZW5ndGgpID09PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VMSUtFKE5JTCwgTElLRV9XSUxEX0NBUkQsIExJS0UsICdCRUdJTlMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIEJFR0lOUyc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyBiID0gdG9TdHJpbmcoYik7IHJldHVybiBiZWdpbnNPcChhLCBiLmxlbmd0aCkgIT09IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTklMLCBMSUtFX1dJTERfQ0FSRCwgTk9UX0xJS0UsICdOT1QgQkVHSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgRU5EUzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IGIgPSB0b1N0cmluZyhiKTsgcmV0dXJuIGVuZHNPcChhLCBiLmxlbmd0aCkgPT09IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIE5JTCwgTElLRSwgJ0VORFMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIEVORFMnOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgYiA9IHRvU3RyaW5nKGIpOyByZXR1cm4gZW5kc09wKGEsIGIubGVuZ3RoKSAhPT0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlTElLRShMSUtFX1dJTERfQ0FSRCwgTklMLCBOT1RfTElLRSwgJ05PVCBFTkRTJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfVxufTtcblxuLy8gc29tZSBzeW5vbnltc1xub3BzWydcXHUyMjY0J10gPSBvcHNbJzw9J107ICAvLyBVTklDT0RFICdMRVNTLVRIQU4gT1IgRVFVQUwgVE8nXG5vcHNbJ1xcdTIyNjUnXSA9IG9wc1snPj0nXTsgIC8vIFVOSUNPREUgJ0dSRUFURVItVEhBTiBPUiBFUVVBTCBUTydcbm9wc1snXFx1MjI2MCddID0gb3BzWyc8PiddOyAgLy8gVU5JQ09ERSAnTk9UIEVRVUFMIFRPJ1xuXG5mdW5jdGlvbiBpbk9wKGEsIGIpIHtcbiAgICByZXR1cm4gYlxuICAgICAgICAudHJpbSgpIC8vIHJlbW92ZSBsZWFkaW5nIGFuZCB0cmFpbGluZyBzcGFjZSBjaGFyc1xuICAgICAgICAucmVwbGFjZSgvXFxzKixcXHMqL2csICcsJykgLy8gcmVtb3ZlIGFueSB3aGl0ZS1zcGFjZSBjaGFycyBmcm9tIGFyb3VuZCBjb21tYXNcbiAgICAgICAgLnNwbGl0KCcsJykgLy8gcHV0IGluIGFuIGFycmF5XG4gICAgICAgIC5pbmRleE9mKChhICsgJycpKTsgLy8gc2VhcmNoIGFycmF5IHdob2xlIG1hdGNoZXNcbn1cblxuZnVuY3Rpb24gY29udGFpbnNPcChhLCBiKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nKGEpLmluZGV4T2YodG9TdHJpbmcoYikpO1xufVxuXG5mdW5jdGlvbiBiZWdpbnNPcChhLCBsZW5ndGgpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcoYSkuc3Vic3RyKDAsIGxlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIGVuZHNPcChhLCBsZW5ndGgpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcoYSkuc3Vic3RyKC1sZW5ndGgsIGxlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIHNxRXNjKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvJy9nLCAnXFwnXFwnJyk7XG59XG5cbnZhciBncm91cHMgPSB7XG4gICAgZXF1YWxpdHk6IHtcbiAgICAgICAgbGFiZWw6ICdFcXVhbGl0eScsXG4gICAgICAgIHN1Ym1lbnU6IFsnPSddXG4gICAgfSxcbiAgICBpbmVxdWFsaXRpZXM6IHtcbiAgICAgICAgbGFiZWw6ICdJbmVxdWFsaXRpZXMnLFxuICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAnPCcsXG4gICAgICAgICAgICAnXFx1MjI2NCcsIC8vIFVOSUNPREUgJ0xFU1MtVEhBTiBPUiBFUVVBTCBUTyc7IG9uIGEgTWFjLCB0eXBlIG9wdGlvbi1jb21tYSAo4omkKVxuICAgICAgICAgICAgJ1xcdTIyNjAnLCAvLyBVTklDT0RFICdOT1QgRVFVQUxTJzsgb24gYSBNYWMsIHR5cGUgb3B0aW9uLWVxdWFscyAo4omgKVxuICAgICAgICAgICAgJ1xcdTIyNjUnLCAvLyBVTklDT0RFICdHUkVBVEVSLVRIQU4gT1IgRVFVQUwgVE8nOyBvbiBhIE1hYywgdHlwZSBvcHRpb24tcGVyaW9kICjiiaUpXG4gICAgICAgICAgICAnPidcbiAgICAgICAgXVxuICAgIH0sXG4gICAgc2V0czoge1xuICAgICAgICBsYWJlbDogJ1NldCBzY2FucycsXG4gICAgICAgIHN1Ym1lbnU6IFsnSU4nLCAnTk9UIElOJ11cbiAgICB9LFxuICAgIHN0cmluZ3M6IHtcbiAgICAgICAgbGFiZWw6ICdTdHJpbmcgc2NhbnMnLFxuICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAnQ09OVEFJTlMnLCAnTk9UIENPTlRBSU5TJyxcbiAgICAgICAgICAgICdCRUdJTlMnLCAnTk9UIEJFR0lOUycsXG4gICAgICAgICAgICAnRU5EUycsICdOT1QgRU5EUydcbiAgICAgICAgXVxuICAgIH0sXG4gICAgcGF0dGVybnM6IHtcbiAgICAgICAgbGFiZWw6ICdQYXR0ZXJuIHNjYW5zJyxcbiAgICAgICAgc3VibWVudTogWydMSUtFJywgJ05PVCBMSUtFJ11cbiAgICB9XG59O1xuXG4vLyBhZGQgYSBgbmFtZWAgcHJvcCB0byBlYWNoIGdyb3VwXG5fKGdyb3VwcykuZWFjaChmdW5jdGlvbihncm91cCwga2V5KSB7IGdyb3VwLm5hbWUgPSBrZXk7IH0pO1xuXG4vKipcbiAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHNcbiAqL1xuQ29uZGl0aW9uYWxzLmdyb3VwcyA9IGdyb3VwcztcblxuLyoqIERlZmF1bHQgb3BlcmF0b3IgbWVudSB3aGVuIGNvbnNpc3Rpbmcgb2YgYWxsIG9mIHRoZSBncm91cHMgaW4ge0BsaW5rIG1vZHVsZTpjb25kaXRpb25hbHMuZ3JvdXBzfGdyb3Vwc30uIFRoaXMgbWVudSBpcyB1c2VkIHdoZW4gbm9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIG90aGVyd2lzZSBkZWZpbmVkOlxuICogKiBUaGUgYG9wTWVudWAgcHJvcGVydHkgb2YgdGhlIGNvbHVtbiBzY2hlbWEuXG4gKiAqIFRoZSBlbnRyeSBpbiB0aGUgbm9kZSdzIGB0eXBlT3BNYXBgIGhhc2ggY29ycmVzcG9uZGluZyB0byB0aGUgYHR5cGVgIHByb3BlcnR5IG9mIHRoZSBjb2x1bW4gc2NoZW1hLlxuICogKiBUaGUgbm9kZSdzIGB0cmVlT3BNZW51YCBvYmplY3QuXG4gKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHNcbiAqL1xuQ29uZGl0aW9uYWxzLmRlZmF1bHRPcE1lbnUgPSBbIC8vIGhpZXJhcmNoaWNhbCBtZW51IG9mIHJlbGF0aW9uYWwgb3BlcmF0b3JzXG4gICAgZ3JvdXBzLmVxdWFsaXR5LFxuICAgIGdyb3Vwcy5pbmVxdWFsaXRpZXMsXG4gICAgZ3JvdXBzLnNldHMsXG4gICAgZ3JvdXBzLnN0cmluZ3MsXG4gICAgZ3JvdXBzLnBhdHRlcm5zXG5dO1xuXG5cbi8vIE1lYW50IHRvIGJlIGNhbGxlZCBieSBGaWx0ZXJUcmVlLnByb3RvdHlwZS5zZXRTZW5zaXRpdml0eSBvbmx5XG5Db25kaXRpb25hbHMuc2V0VG9TdHJpbmcgPSBmdW5jdGlvbihmbikge1xuICAgIHJldHVybiAodG9TdHJpbmcgPSBmbik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbmFscztcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuLyogZXNsaW50LWRpc2FibGUga2V5LXNwYWNpbmcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBGaWx0ZXJOb2RlID0gcmVxdWlyZSgnLi9GaWx0ZXJOb2RlJyk7XG52YXIgQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi9Db25kaXRpb25hbHMnKTtcblxuXG52YXIgdG9TdHJpbmc7IC8vIHNldCBieSBGaWx0ZXJMZWFmLnNldFRvU3RyaW5nKCkgY2FsbGVkIGZyb20gLi4vaW5kZXguanNcblxuXG4vKiogQHR5cGVkZWYge29iamVjdH0gY29udmVydGVyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSB0b1R5cGUgLSBSZXR1cm5zIGlucHV0IHZhbHVlIGNvbnZlcnRlZCB0byB0eXBlLiBGYWlscyBzaWxlbnRseS5cbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IGZhaWxlZCAtIFRlc3RzIGlucHV0IHZhbHVlIGFnYWluc3QgdHlwZSwgcmV0dXJuaW5nIGBmYWxzZSBpZiB0eXBlIG9yIGB0cnVlYCBpZiBub3QgdHlwZS5cbiAqL1xuXG4vKiogQHR5cGUge2NvbnZlcnRlcn0gKi9cbnZhciBudW1iZXJDb252ZXJ0ZXIgPSB7XG4gICAgdG9UeXBlOiBOdW1iZXIsXG4gICAgZmFpbGVkOiBpc05hTlxufTtcblxuLyoqIEB0eXBlIHtjb252ZXJ0ZXJ9ICovXG52YXIgZGF0ZUNvbnZlcnRlciA9IHtcbiAgICB0b1R5cGU6IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIG5ldyBEYXRlKHMpOyB9LFxuICAgIGZhaWxlZDogaXNOYU5cbn07XG5cbi8qKlxuICogQHR5cGVkZWYge29iamVjdH0gZmlsdGVyTGVhZlZpZXdPYmplY3RcbiAqXG4gKiBAcHJvcGVydHkge0hUTUxFbGVtZW50fSBjb2x1bW4gLSBBIGRyb3AtZG93biB3aXRoIG9wdGlvbnMgZnJvbSB0aGUgYEZpbHRlckxlYWZgIGluc3RhbmNlJ3Mgc2NoZW1hLiBWYWx1ZSBpcyB0aGUgbmFtZSBvZiB0aGUgY29sdW1uIGJlaW5nIHRlc3RlZCAoaS5lLiwgdGhlIGNvbHVtbiB0byB3aGljaCB0aGlzIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gYXBwbGllcykuXG4gKlxuICogQHByb3BlcnR5IG9wZXJhdG9yIC0gQSBkcm9wLWRvd24gd2l0aCBvcHRpb25zIGZyb20ge0BsaW5rIGNvbHVtbk9wTWVudX0sIHtAbGluayB0eXBlT3BNYXB9LCBvciB7QGxpbmsgdHJlZU9wTWVudX0uIFZhbHVlIGlzIHRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9wZXJhdG9yLlxuICpcbiAqIEBwcm9wZXJ0eSBvcGVyYW5kIC0gQW4gaW5wdXQgZWxlbWVudCwgc3VjaCBhcyBhIGRyb3AtZG93biBvciBhIHRleHQgYm94LlxuICovXG5cbi8qKiBAY29uc3RydWN0b3JcbiAqIEBzdW1tYXJ5IEFuIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgYSBjb25kaXRpb25hbCBleHByZXNzaW9uIG5vZGUgaW4gYSBmaWx0ZXIgdHJlZS5cbiAqIEBkZXNjIFRoaXMgb2JqZWN0IHJlcHJlc2VudHMgYSBjb25kaXRpb25hbCBleHByZXNzaW9uLiBJdCBpcyBhbHdheXMgYSB0ZXJtaW5hbCBub2RlIGluIHRoZSBmaWx0ZXIgdHJlZTsgaXQgaGFzIG5vIGNoaWxkIG5vZGVzIG9mIGl0cyBvd24uXG4gKlxuICogQSBjb25kaXRpb25hbCBleHByZXNzaW9uIGlzIGEgc2ltcGxlIGR5YWRpYyBleHByZXNzaW9uIHdpdGggdGhlIGZvbGxvd2luZyBzeW50YXggaW4gdGhlIFVJOlxuICpcbiAqID4gX2NvbHVtbiBvcGVyYXRvciBvcGVyYW5kX1xuICpcbiAqIHdoZXJlOlxuICogKiBfY29sdW1uXyBpcyB0aGUgbmFtZSBvZiBhIGNvbHVtbiBmcm9tIHRoZSBkYXRhIHJvdyBvYmplY3RcbiAqICogX29wZXJhdG9yXyBpcyB0aGUgbmFtZSBvZiBhbiBvcGVyYXRvciBmcm9tIHRoZSBub2RlJ3Mgb3BlcmF0b3IgbGlzdFxuICogKiBfb3BlcmFuZF8gaXMgYSBsaXRlcmFsIHZhbHVlIHRvIGNvbXBhcmUgYWdhaW5zdCB0aGUgdmFsdWUgaW4gdGhlIG5hbWVkIGNvbHVtblxuICpcbiAqICoqTk9URToqKiBUaGUge0BsaW5rIENvbHVtbkxlYWZ9IGV4dGVuc2lvbiBvZiB0aGlzIG9iamVjdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgX29wZXJhbmRfIHdoaWNoIGlzOiBUaGUgbmFtZSBvZiBhIGNvbHVtbiBmcm9tIHdoaWNoIHRvIGZldGNoIHRoZSBjb21wYXJlIHZhbHVlIChmcm9tIHRoZSBzYW1lIGRhdGEgcm93IG9iamVjdCkgdG8gY29tcGFyZSBhZ2FpbnN0IHRoZSB2YWx1ZSBpbiB0aGUgbmFtZWQgY29sdW1uLiBTZWUgKkV4dGVuZGluZyB0aGUgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBvYmplY3QqIGluIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvaW5kZXguaHRtbHxyZWFkbWV9LlxuICpcbiAqIFRoZSB2YWx1ZXMgb2YgdGhlIHRlcm1zIG9mIHRoZSBleHByZXNzaW9uIGFib3ZlIGFyZSBzdG9yZWQgaW4gdGhlIGZpcnN0IHRocmVlIHByb3BlcnRpZXMgYmVsb3cuIEVhY2ggb2YgdGhlc2UgdGhyZWUgcHJvcGVydGllcyBpcyBzZXQgZWl0aGVyIGJ5IGBzZXRTdGF0ZSgpYCBvciBieSB0aGUgdXNlciB2aWEgYSBjb250cm9sIGluIGBlbGAuIE5vdGUgdGhhdCB0aGVzZSBwcm9wZXJ0aWVzIGFyZSBub3QgZHluYW1pY2FsbHkgYm91bmQgdG8gdGhlIFVJIGNvbnRyb2xzOyB0aGV5IGFyZSB1cGRhdGVkIGJ5IHRoZSB2YWxpZGF0aW9uIGZ1bmN0aW9uLCBgaW52YWxpZCgpYC5cbiAqXG4gKiAqKlNlZSBhbHNvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzdXBlcmNsYXNzOioqIHtAbGluayBGaWx0ZXJOb2RlfVxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjb2x1bW4gLSBOYW1lIG9mIHRoZSBtZW1iZXIgaW4gdGhlIGRhdGEgcm93IG9iamVjdHMgYWdhaW5zdCB3aGljaCBgb3BlcmFuZGAgd2lsbCBiZSBjb21wYXJlZC4gUmVmbGVjdHMgdGhlIHZhbHVlIG9mIHRoZSBgdmlldy5jb2x1bW5gIGNvbnRyb2wgYWZ0ZXIgdmFsaWRhdGlvbi5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gb3BlcmF0b3IgLSBPcGVyYXRvciBzeW1ib2wuIFRoaXMgbXVzdCBtYXRjaCBhIGtleSBpbiB0aGUgYHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzYCBoYXNoLiBSZWZsZWN0cyB0aGUgdmFsdWUgb2YgdGhlIGB2aWV3Lm9wZXJhdG9yYCBjb250cm9sIGFmdGVyIHZhbGlkYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wZXJhbmQgLSBWYWx1ZSB0byBjb21wYXJlIGFnYWluc3QgdGhlIHRoZSBtZW1iZXIgb2YgZGF0YSByb3cgbmFtZWQgYnkgYGNvbHVtbmAuIFJlZmxlY3RzIHRoZSB2YWx1ZSBvZiB0aGUgYHZpZXcub3BlcmFuZGAgY29udHJvbCwgYWZ0ZXIgdmFsaWRhdGlvbi5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtIFVzZWQgdG8gZGVzY3JpYmUgdGhlIG9iamVjdCBpbiB0aGUgVUkgc28gdXNlciBjYW4gc2VsZWN0IGFuIGV4cHJlc3Npb24gZWRpdG9yLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZT0nc3RyaW5nJ10gLSBUaGUgZGF0YSB0eXBlIG9mIHRoZSBzdWJleHByZXNzaW9uIGlmIG5laXRoZXIgdGhlIG9wZXJhdG9yIG5vciB0aGUgY29sdW1uIHNjaGVtYSBkZWZpbmVzIGEgdHlwZS5cbiAqXG4gKiBAcHJvcGVydHkge0hUTUxFbGVtZW50fSBlbCAtIEEgYDxzcGFuPi4uLjwvc3Bhbj5gIGVsZW1lbnQgdGhhdCBjb250YWlucyB0aGUgVUkgY29udHJvbHMuIFRoaXMgZWxlbWVudCBpcyBhdXRvbWF0aWNhbGx5IGFwcGVuZWRlZCB0byB0aGUgcGFyZW50IGBGaWx0ZXJUcmVlYCdzIGBlbGAuIEdlbmVyYXRlZCBieSB7QGxpbmsgRmlsdGVyTGVhZiNjcmVhdGVWaWV3fGNyZWF0ZVZpZXd9LlxuICpcbiAqIEBwcm9wZXJ0eSB7ZmlsdGVyTGVhZlZpZXdPYmplY3R9IHZpZXcgLSBBIGhhc2ggY29udGFpbmluZyBkaXJlY3QgcmVmZXJlbmNlcyB0byB0aGUgY29udHJvbHMgaW4gYGVsYC4gQWRkZWQgYnkge0BsaW5rIEZpbHRlckxlYWYjY3JlYXRlVmlld3xjcmVhdGVWaWV3fS5cbiAqL1xudmFyIEZpbHRlckxlYWYgPSBGaWx0ZXJOb2RlLmV4dGVuZCgnRmlsdGVyTGVhZicsIHtcblxuICAgIG5hbWU6ICdjb2x1bW4gPSB2YWx1ZScsIC8vIGRpc3BsYXkgc3RyaW5nIGZvciBkcm9wLWRvd25cblxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy52aWV3KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy52aWV3KSB7XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3W2tleV0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5vbkNoYW5nZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IENyZWF0ZSBhIG5ldyB2aWV3LlxuICAgICAqIEBkZXNjIFRoaXMgbmV3IFwidmlld1wiIGlzIGEgZ3JvdXAgb2YgSFRNTCBgRWxlbWVudGAgY29udHJvbHMgdGhhdCBjb21wbGV0ZWx5IGRlc2NyaWJlIHRoZSBjb25kaXRpb25hbCBleHByZXNzaW9uIHRoaXMgb2JqZWN0IHJlcHJlc2VudHMuIFRoaXMgbWV0aG9kIGNyZWF0ZXMgdGhlIHZpZXcsIHNldHRpbmcgYHRoaXMuZWxgIHRvIHBvaW50IHRvIGl0LCBhbmQgdGhlIG1lbWJlcnMgb2YgYHRoaXMudmlld2AgdG8gcG9pbnQgdG8gdGhlIGluZGl2aWR1YWwgY29udHJvbHMgdGhlcmVpbi5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTGVhZiNcbiAgICAgKi9cbiAgICBjcmVhdGVWaWV3OiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXG4gICAgICAgIGVsLmNsYXNzTmFtZSA9ICdmaWx0ZXItdHJlZS1lZGl0b3IgZmlsdGVyLXRyZWUtZGVmYXVsdCc7XG5cbiAgICAgICAgaWYgKHN0YXRlICYmIHN0YXRlLmNvbHVtbikge1xuICAgICAgICAgICAgLy8gU3RhdGUgaW5jbHVkZXMgY29sdW1uOlxuICAgICAgICAgICAgLy8gT3BlcmF0b3IgbWVudSBpcyBidWlsdCBsYXRlciBpbiBsb2FkU3RhdGU7IHdlIGRvbid0IG5lZWQgdG8gYnVpbGQgaXQgbm93LiBUaGUgY2FsbCB0b1xuICAgICAgICAgICAgLy8gZ2V0T3BNZW51IGJlbG93IHdpdGggdW5kZWZpbmVkIGNvbHVtbk5hbWUgcmV0dXJucyBbXSByZXN1bHRpbmcgaW4gYW4gZW1wdHkgZHJvcC1kb3duLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gV2hlbiBzdGF0ZSBkb2VzIE5PVCBpbmNsdWRlIGNvbHVtbiwgaXQncyBiZWNhdXNlIGVpdGhlcjpcbiAgICAgICAgICAgIC8vIGEuIGNvbHVtbiBpcyB1bmtub3duIGFuZCBvcCBtZW51IHdpbGwgYmUgZW1wdHkgdW50aWwgdXNlciBjaG9vc2VzIGEgY29sdW1uOyBvclxuICAgICAgICAgICAgLy8gYi4gY29sdW1uIGlzIGhhcmQtY29kZWQgd2hlbiB0aGVyZSdzIG9ubHkgb25lIHBvc3NpYmxlIGNvbHVtbiBhcyBpbmZlcmFibGUgZnJvbSBzY2hlbWE6XG4gICAgICAgICAgICB2YXIgc2NoZW1hID0gdGhpcy5zY2hlbWEgJiYgdGhpcy5zY2hlbWEubGVuZ3RoID09PSAxICYmIHRoaXMuc2NoZW1hWzBdLFxuICAgICAgICAgICAgICAgIGNvbHVtbk5hbWUgPSBzY2hlbWEgJiYgc2NoZW1hLm5hbWUgfHwgc2NoZW1hO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52aWV3ID0ge1xuICAgICAgICAgICAgY29sdW1uOiB0aGlzLm1ha2VFbGVtZW50KHRoaXMuc2NoZW1hLCAnY29sdW1uJywgdGhpcy5zb3J0Q29sdW1uTWVudSksXG4gICAgICAgICAgICBvcGVyYXRvcjogdGhpcy5tYWtlRWxlbWVudChnZXRPcE1lbnUuY2FsbCh0aGlzLCBjb2x1bW5OYW1lKSwgJ29wZXJhdG9yJyksXG4gICAgICAgICAgICBvcGVyYW5kOiB0aGlzLm1ha2VFbGVtZW50KClcbiAgICAgICAgfTtcblxuICAgICAgICBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpKTtcbiAgICB9LFxuXG4gICAgbG9hZFN0YXRlOiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB2YXIgdmFsdWUsIGVsLCBpLCBiLCBzZWxlY3RlZCwgb3BzLCB0aGlzT3AsIG9wTWVudSwgbm90ZXM7XG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgbm90ZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzdGF0ZSkge1xuICAgICAgICAgICAgICAgIGlmICghRmlsdGVyTm9kZS5vcHRpb25zU2NoZW1hW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzW2tleV0gPSBzdGF0ZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICBlbCA9IHRoaXMudmlld1trZXldO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGVsLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2NoZWNrYm94JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3JhZGlvJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W25hbWU9XFwnJyArIGVsLm5hbWUgKyAnXFwnXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBlbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbFtpXS5jaGVja2VkID0gdmFsdWUuaW5kZXhPZihlbFtpXS52YWx1ZSkgPj0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdzZWxlY3QtbXVsdGlwbGUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gZWwub3B0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBiID0gZmFsc2U7IGkgPCBlbC5sZW5ndGg7IGkrKywgYiA9IGIgfHwgc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWQgPSB2YWx1ZS5pbmRleE9mKGVsW2ldLnZhbHVlKSA+PSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbFtpXS5zZWxlY3RlZCA9IHNlbGVjdGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCwgYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsLnZhbHVlID09PSAnJyAmJiBrZXkgPT09ICdvcGVyYXRvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmF0b3IgbWF5IGJlIGEgc3lub255bS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BzID0gdGhpcy5yb290LmNvbmRpdGlvbmFscy5vcHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNPcCA9IG9wc1t2YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wTWVudSA9IGdldE9wTWVudS5jYWxsKHRoaXMsIHN0YXRlLmNvbHVtbiB8fCB0aGlzLmNvbHVtbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGVhY2ggbWVudSBpdGVtJ3Mgb3Agb2JqZWN0IGZvciBlcXVpdmFsZW5jeSB0byBwb3NzaWJsZSBzeW5vbnltJ3Mgb3Agb2JqZWN0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3BNZW51LndhbGsuY2FsbChvcE1lbnUsIGVxdWl2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXMucHVzaCh7IGtleToga2V5LCB2YWx1ZTogdmFsdWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdjb2x1bW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ha2VPcE1lbnUuY2FsbCh0aGlzLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBtdWx0aXBsZSA9IG5vdGVzLmxlbmd0aCA+IDEsXG4gICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlcyA9IHRoaXMudGVtcGxhdGVzLFxuICAgICAgICAgICAgICAgICAgICBmb290bm90ZXMgPSB0ZW1wbGF0ZXMuZ2V0KG11bHRpcGxlID8gJ25vdGVzJyA6ICdub3RlJyksXG4gICAgICAgICAgICAgICAgICAgIGlubmVyID0gZm9vdG5vdGVzLnF1ZXJ5U2VsZWN0b3IoJy5mb290bm90ZScpO1xuICAgICAgICAgICAgICAgIG5vdGVzLmZvckVhY2goZnVuY3Rpb24obm90ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm9vdG5vdGUgPSBtdWx0aXBsZSA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJykgOiBpbm5lcjtcbiAgICAgICAgICAgICAgICAgICAgbm90ZSA9IHRlbXBsYXRlcy5nZXQoJ29wdGlvbk1pc3NpbmcnLCBub3RlLmtleSwgbm90ZS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChub3RlLmxlbmd0aCkgeyBmb290bm90ZS5hcHBlbmRDaGlsZChub3RlWzBdKTsgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobXVsdGlwbGUpIHsgaW5uZXIuYXBwZW5kQ2hpbGQoZm9vdG5vdGUpOyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5vdGVzRWwgPSBmb290bm90ZXM7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gZXF1aXYob3BNZW51SXRlbSkge1xuICAgICAgICAgICAgdmFyIG9wTmFtZSA9IG9wTWVudUl0ZW0ubmFtZSB8fCBvcE1lbnVJdGVtO1xuICAgICAgICAgICAgaWYgKG9wc1tvcE5hbWVdID09PSB0aGlzT3ApIHtcbiAgICAgICAgICAgICAgICBlbC52YWx1ZSA9IG9wTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gbnVtYmVyXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IGludCAtIHN5bm9ueW0gb2YgYG51bWJlcmBcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gZmxvYXQgLSBzeW5vbnltIG9mIGBudW1iZXJgXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IGRhdGVcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gc3RyaW5nXG4gICAgICovXG4gICAgY29udmVydGVyczoge1xuICAgICAgICBudW1iZXI6IG51bWJlckNvbnZlcnRlcixcbiAgICAgICAgaW50OiBudW1iZXJDb252ZXJ0ZXIsXG4gICAgICAgIGZsb2F0OiBudW1iZXJDb252ZXJ0ZXIsXG4gICAgICAgIGRhdGU6IGRhdGVDb252ZXJ0ZXJcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIGJ5IHRoZSBwYXJlbnQgbm9kZSdzIHtAbGluayBGaWx0ZXJUcmVlI2ludmFsaWR8aW52YWxpZCgpfSBtZXRob2QsIHdoaWNoIGNhdGNoZXMgdGhlIGVycm9yIHRocm93biB3aGVuIGludmFsaWQuXG4gICAgICpcbiAgICAgKiBBbHNvIHBlcmZvcm1zIHRoZSBmb2xsb3dpbmcgY29tcGlsYXRpb24gYWN0aW9uczpcbiAgICAgKiAqIENvcGllcyBhbGwgYHRoaXMudmlld2AnIHZhbHVlcyBmcm9tIHRoZSBET00gdG8gc2ltaWxhcmx5IG5hbWVkIHByb3BlcnRpZXMgb2YgYHRoaXNgLlxuICAgICAqICogUHJlLXNldHMgYHRoaXMub3BgIGFuZCBgdGhpcy5jb252ZXJ0ZXJgIGZvciB1c2UgaW4gYHRlc3RgJ3MgdHJlZSB3YWxrLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy50aHJvdz1mYWxzZV0gLSBUaHJvdyBhbiBlcnJvciBpZiBtaXNzaW5nIG9yIGludmFsaWQgdmFsdWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mb2N1cz1mYWxzZV0gLSBNb3ZlIGZvY3VzIHRvIG9mZmVuZGluZyBjb250cm9sLlxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9IFRoaXMgaXMgdGhlIG5vcm1hbCByZXR1cm4gd2hlbiB2YWxpZDsgb3RoZXJ3aXNlIHRocm93cyBlcnJvciB3aGVuIGludmFsaWQuXG4gICAgICogQG1lbWJlck9mIEZpbHRlckxlYWYjXG4gICAgICovXG4gICAgaW52YWxpZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUsIHR5cGUsIGZvY3VzZWQ7XG5cbiAgICAgICAgZm9yIChlbGVtZW50TmFtZSBpbiB0aGlzLnZpZXcpIHtcbiAgICAgICAgICAgIHZhciBlbCA9IHRoaXMudmlld1tlbGVtZW50TmFtZV0sXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBjb250cm9sVmFsdWUoZWwpLnRyaW0oKTtcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHZhbHVlID09PSAnJyAmJiBlbGVtZW50TmFtZSA9PT0gJ29wZXJhdG9yJyAmJiAvLyBub3QgaW4gb3BlcmF0b3IgbWVudVxuICAgICAgICAgICAgICAgIHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdICYmIC8vIGJ1dCB2YWxpZCBpbiBvcGVyYXRvciBoYXNoXG4gICAgICAgICAgICAgICAgIWdldFByb3BlcnR5LmNhbGwodGhpcywgdGhpcy5jb2x1bW4sICdvcE11c3RCZUluTWVudScpIC8vIGFuZCBpcyBkb2Vzbid0IGhhdmUgdG8gYmUgaW4gbWVudSB0byBiZSB2YWxpZFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzLm9wZXJhdG9yOyAvLyB1c2UgaXQgYXMgaXMgdGhlblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmb2N1c2VkICYmIG9wdGlvbnMgJiYgb3B0aW9ucy5mb2N1cykge1xuICAgICAgICAgICAgICAgICAgICBjbGlja0luKGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZm9jdXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudGhyb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuRXJyb3IoJ01pc3Npbmcgb3IgaW52YWxpZCAnICsgZWxlbWVudE5hbWUgKyAnIGluIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24uIENvbXBsZXRlIHRoZSBleHByZXNzaW9uIG9yIHJlbW92ZSBpdC4nLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvcHkgZWFjaCBjb250cm9scydzIHZhbHVlIGFzIGEgbmV3IHNpbWlsYXJseSBuYW1lZCBwcm9wZXJ0eSBvZiB0aGlzIG9iamVjdC5cbiAgICAgICAgICAgICAgICB0aGlzW2VsZW1lbnROYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vcCA9IHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdO1xuXG4gICAgICAgIHR5cGUgPSB0aGlzLmdldFR5cGUoKTtcblxuICAgICAgICB0aGlzLmNvbnZlcnRlciA9IHR5cGUgJiYgdHlwZSAhPT0gJ3N0cmluZycgJiYgdGhpcy5jb252ZXJ0ZXJzW3R5cGVdO1xuXG4gICAgICAgIHRoaXMuY2FsY3VsYXRvciA9IHRoaXMuZ2V0Q2FsY3VsYXRvcigpO1xuICAgIH0sXG5cbiAgICBnZXRUeXBlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3AudHlwZSB8fCBnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIHRoaXMuY29sdW1uLCAndHlwZScpO1xuICAgIH0sXG5cbiAgICBnZXRDYWxjdWxhdG9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGdldFByb3BlcnR5LmNhbGwodGhpcywgdGhpcy5jb2x1bW4sICdjYWxjdWxhdG9yJyk7XG4gICAgfSxcblxuICAgIHZhbE9yRnVuYzogZnVuY3Rpb24oY29sdW1uTmFtZSkge1xuICAgICAgICB2YXIgcmVzdWx0LCBjYWxjdWxhdG9yO1xuICAgICAgICBpZiAodGhpcykge1xuICAgICAgICAgICAgcmVzdWx0ID0gdGhpc1tjb2x1bW5OYW1lXTtcbiAgICAgICAgICAgIGNhbGN1bGF0b3IgPSAodHlwZW9mIHJlc3VsdClbMF0gPT09ICdmJyAmJiByZXN1bHQgfHwgdGhpcy5jYWxjdWxhdG9yO1xuICAgICAgICAgICAgaWYgKGNhbGN1bGF0b3IpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBjYWxjdWxhdG9yLmNhbGwodGhpcywgY29sdW1uTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdCB8fCByZXN1bHQgPT09IDAgfHwgcmVzdWx0ID09PSBmYWxzZSA/IHJlc3VsdCA6ICcnO1xuICAgIH0sXG5cbiAgICBwOiBmdW5jdGlvbihkYXRhUm93KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZhbE9yRnVuYy5jYWxsKGRhdGFSb3csIHRoaXMuY29sdW1uKTtcbiAgICB9LFxuXG4gICAgLy8gVG8gYmUgb3ZlcnJpZGRlbiB3aGVuIG9wZXJhbmQgaXMgYSBjb2x1bW4gbmFtZSAoc2VlIGNvbHVtbnMuanMpLlxuICAgIHE6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcGVyYW5kO1xuICAgIH0sXG5cbiAgICB0ZXN0OiBmdW5jdGlvbihkYXRhUm93KSB7XG4gICAgICAgIHZhciBwLCBxLCAvLyB1bnR5cGVkIHZlcnNpb25zIG9mIGFyZ3NcbiAgICAgICAgICAgIFAsIFEsIC8vIHR5cGVkIHZlcnNpb25zIG9mIHAgYW5kIHFcbiAgICAgICAgICAgIGNvbnZlcnRlcjtcblxuICAgICAgICAvLyBUT0RPOiBJZiBhIGxpdGVyYWwgKGkuZS4sIHdoZW4gdGhpcy5xIGlzIG5vdCBvdmVycmlkZGVuKSwgcSBvbmx5IG5lZWRzIHRvIGJlIGZldGNoZWQgT05DRSBmb3IgYWxsIHJvd3NcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIChwID0gdGhpcy5wKGRhdGFSb3cpKSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAocSA9IHRoaXMucShkYXRhUm93KSkgPT09IHVuZGVmaW5lZFxuICAgICAgICApXG4gICAgICAgICAgICA/IGZhbHNlIC8vIGRhdGEgaW5hY2Nlc3NpYmxlIHNvIGV4Y2x1ZGUgcm93XG4gICAgICAgICAgICA6IChcbiAgICAgICAgICAgICAgICAoY29udmVydGVyID0gdGhpcy5jb252ZXJ0ZXIpICYmXG4gICAgICAgICAgICAgICAgIWNvbnZlcnRlci5mYWlsZWQoUCA9IGNvbnZlcnRlci50b1R5cGUocCkpICYmIC8vIGF0dGVtcHQgdG8gY29udmVydCBkYXRhIHRvIHR5cGVcbiAgICAgICAgICAgICAgICAhY29udmVydGVyLmZhaWxlZChRID0gY29udmVydGVyLnRvVHlwZShxKSlcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICA/IHRoaXMub3AudGVzdChQLCBRKSAvLyBib3RoIGNvbnZlcnNpb25zIHN1Y2Nlc3NmdWw6IGNvbXBhcmUgYXMgdHlwZXNcbiAgICAgICAgICAgICAgICA6IHRoaXMub3AudGVzdCh0b1N0cmluZyhwKSwgdG9TdHJpbmcocSkpOyAvLyBvbmUgb3IgYm90aCBjb252ZXJzaW9ucyBmYWlsZWQ6IGNvbXBhcmUgYXMgc3RyaW5nc1xuICAgIH0sXG5cbiAgICB0b0pTT046IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdGUgPSB7fTtcbiAgICAgICAgaWYgKHRoaXMuZWRpdG9yKSB7XG4gICAgICAgICAgICBzdGF0ZS5lZGl0b3IgPSB0aGlzLmVkaXRvcjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy52aWV3KSB7XG4gICAgICAgICAgICBzdGF0ZVtrZXldID0gdGhpc1trZXldO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnNjaGVtYSAhPT0gdGhpcy5wYXJlbnQuc2NoZW1hKSB7XG4gICAgICAgICAgICBzdGF0ZS5zY2hlbWEgPSB0aGlzLnNjaGVtYTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBgJ29iamVjdCdgIGFuZCBgJ0pTT04nYCBub3RlIHRoYXQgdGhlIHN1YnRyZWUncyB2ZXJzaW9uIG9mIGBnZXRTdGF0ZWAgd2lsbCBub3QgY2FsbCB0aGlzIGxlYWYgdmVyc2lvbiBvZiBgZ2V0U3RhdGVgIGJlY2F1c2UgdGhlIGZvcm1lciB1c2VzIGB1bnN0cnVuZ2lmeSgpYCBhbmQgYEpTT04uc3RyaW5naWZ5KClgLCByZXNwZWN0aXZlbHksIGJvdGggb2Ygd2hpY2ggcmVjdXJzZSBhbmQgY2FsbCBgdG9KU09OKClgIG9uIHRoZWlyIG93bi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucz0nb2JqZWN0J10gLSBTZWUgdGhlIHN1YnRyZWUgdmVyc2lvbiBvZiB7QGxpbmsgRmlsdGVyVHJlZSNnZXRTdGF0ZXxnZXRTdGF0ZX0gZm9yIG1vcmUgaW5mby5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJMZWFmI1xuICAgICAqL1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAnJyxcbiAgICAgICAgICAgIHN5bnRheCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggfHwgJ29iamVjdCc7XG5cbiAgICAgICAgc3dpdGNoIChzeW50YXgpIHtcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IC8vIHNlZSBub3RlIGFib3ZlXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy50b0pTT04oKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0pTT04nOiAvLyBzZWUgbm90ZSBhYm92ZVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIG9wdGlvbnMgJiYgb3B0aW9ucy5zcGFjZSkgfHwgJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdTUUwnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuZ2V0U3ludGF4KHRoaXMucm9vdC5jb25kaXRpb25hbHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgbWFrZVNxbE9wZXJhbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yb290LmNvbmRpdGlvbmFscy5tYWtlU3FsU3RyaW5nKHRoaXMub3BlcmFuZCk7IC8vIHRvZG86IHRoaXMgc2hvdWxkIGJlIGEgbnVtYmVyIGlmIHR5cGUgaXMgbnVtYmVyIGluc3RlYWQgb2YgYSBzdHJpbmcgLS0gYnV0IHdlIHdpbGwgaGF2ZSB0byBlbnN1cmUgaXQgaXMgbnVtZXJpYyFcbiAgICB9LFxuXG4gICAgZ2V0U3ludGF4OiBmdW5jdGlvbihjb25kaXRpb25hbHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdLm1ha2UuY2FsbChjb25kaXRpb25hbHMsIHRoaXMpO1xuICAgIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgSFRNTCBmb3JtIGNvbnRyb2xzIGZhY3RvcnkuXG4gICAgICogQGRlc2MgQ3JlYXRlcyBhbmQgYXBwZW5kcyBhIHRleHQgYm94IG9yIGEgZHJvcC1kb3duLlxuICAgICAqID4gRGVmaW5lZCBvbiB0aGUgRmlsdGVyVHJlZSBwcm90b3R5cGUgZm9yIGFjY2VzcyBieSBkZXJpdmVkIHR5cGVzIChhbHRlcm5hdGUgZmlsdGVyIGVkaXRvcnMpLlxuICAgICAqIEByZXR1cm5zIFRoZSBuZXcgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge21lbnVJdGVtW119IFttZW51XSAtIE92ZXJsb2FkczpcbiAgICAgKiAqIElmIG9taXR0ZWQsIHdpbGwgY3JlYXRlIGFuIGA8aW5wdXQvPmAgKHRleHQgYm94KSBlbGVtZW50LlxuICAgICAqICogSWYgY29udGFpbnMgb25seSBhIHNpbmdsZSBvcHRpb24sIHdpbGwgY3JlYXRlIGEgYDxzcGFuPi4uLjwvc3Bhbj5gIGVsZW1lbnQgY29udGFpbmluZyB0aGUgc3RyaW5nIGFuZCBhIGA8aW5wdXQgdHlwZT1oaWRkZW4+YCBjb250YWluaW5nIHRoZSB2YWx1ZS5cbiAgICAgKiAqIE90aGVyd2lzZSwgY3JlYXRlcyBhIGA8c2VsZWN0Pi4uLjwvc2VsZWN0PmAgZWxlbWVudCB3aXRoIHRoZXNlIG1lbnUgaXRlbXMuXG4gICAgICogQHBhcmFtIHtudWxsfHN0cmluZ30gW3Byb21wdD0nJ10gLSBBZGRzIGFuIGluaXRpYWwgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50IHRvIHRoZSBkcm9wLWRvd24gd2l0aCB0aGlzIHZhbHVlLCBwYXJlbnRoZXNpemVkLCBhcyBpdHMgYHRleHRgOyBhbmQgZW1wdHkgc3RyaW5nIGFzIGl0cyBgdmFsdWVgLiBPbWl0dGluZyBjcmVhdGVzIGEgYmxhbmsgcHJvbXB0OyBgbnVsbGAgc3VwcHJlc3Nlcy5cbiAgICAgKiBAcGFyYW0gW3NvcnRdXG4gICAgICogQG1lbWJlck9mIEZpbHRlckxlYWYjXG4gICAgICovXG4gICAgbWFrZUVsZW1lbnQ6IGZ1bmN0aW9uKG1lbnUsIHByb21wdCwgc29ydCkge1xuICAgICAgICB2YXIgZWwsIHJlc3VsdCwgb3B0aW9ucyxcbiAgICAgICAgICAgIG9wdGlvbiA9IG1lbnUsXG4gICAgICAgICAgICB0YWdOYW1lID0gbWVudSA/ICdTRUxFQ1QnIDogJ0lOUFVUJztcblxuICAgICAgICAvLyBkZXRlcm1pbmUgaWYgdGhlcmUgd291bGQgYmUgb25seSBhIHNpbmdsZSBpdGVtIGluIHRoZSBkcm9wZG93blxuICAgICAgICB3aGlsZSAob3B0aW9uIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb24ubGVuZ3RoID09PSAxICYmICFwb3BNZW51LmlzR3JvdXBQcm94eShvcHRpb25bMF0pKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9uID0gb3B0aW9uWzBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9uKSB7XG4gICAgICAgICAgICAvLyBoYXJkIHRleHQgd2hlbiBzaW5nbGUgaXRlbVxuICAgICAgICAgICAgZWwgPSB0aGlzLnRlbXBsYXRlcy5nZXQoXG4gICAgICAgICAgICAgICAgJ2xvY2tlZENvbHVtbicsXG4gICAgICAgICAgICAgICAgb3B0aW9uLmFsaWFzIHx8IG9wdGlvbi5uYW1lIHx8IG9wdGlvbixcbiAgICAgICAgICAgICAgICBvcHRpb24ubmFtZSB8fCBvcHRpb24uYWxpYXMgfHwgb3B0aW9uXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmVzdWx0ID0gZWwucXVlcnlTZWxlY3RvcignaW5wdXQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgcHJvbXB0OiBwcm9tcHQsXG4gICAgICAgICAgICAgICAgc29ydDogc29ydCxcbiAgICAgICAgICAgICAgICBncm91cDogZnVuY3Rpb24oZ3JvdXBOYW1lKSB7IHJldHVybiBDb25kaXRpb25hbHMuZ3JvdXBzW2dyb3VwTmFtZV07IH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIG1ha2UgYW4gZWxlbWVudFxuICAgICAgICAgICAgZWwgPSBwb3BNZW51LmJ1aWxkKHRhZ05hbWUsIG1lbnUsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAvLyBpZiBpdCdzIGEgdGV4dGJveCwgbGlzdGVuIGZvciBrZXl1cCBldmVudHNcbiAgICAgICAgICAgIGlmIChlbC50eXBlID09PSAndGV4dCcgJiYgdGhpcy5ldmVudEhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5ldmVudEhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgb25jaGFuZ2UgZXZlbnRzXG4gICAgICAgICAgICB0aGlzLm9uQ2hhbmdlID0gdGhpcy5vbkNoYW5nZSB8fCBjbGVhblVwQW5kTW92ZU9uLmJpbmQodGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMub25DaGFuZ2UpO1xuXG4gICAgICAgICAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCk7XG4gICAgICAgICAgICByZXN1bHQgPSBlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZWwuYXBwZW5kQ2hpbGQoZWwpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufSk7XG5cbi8qKiBgY2hhbmdlYCBldmVudCBoYW5kbGVyIGZvciBhbGwgZm9ybSBjb250cm9scy5cbiAqIFJlYnVpbGRzIHRoZSBvcGVyYXRvciBkcm9wLWRvd24gYXMgbmVlZGVkLlxuICogUmVtb3ZlcyBlcnJvciBDU1MgY2xhc3MgZnJvbSBjb250cm9sLlxuICogQWRkcyB3YXJuaW5nIENTUyBjbGFzcyBmcm9tIGNvbnRyb2wgaWYgYmxhbms7IHJlbW92ZXMgaWYgbm90IGJsYW5rLlxuICogQWRkcyB3YXJuaW5nIENTUyBjbGFzcyBmcm9tIGNvbnRyb2wgaWYgYmxhbms7IHJlbW92ZXMgaWYgbm90IGJsYW5rLlxuICogTW92ZXMgZm9jdXMgdG8gbmV4dCBub24tYmxhbmsgc2libGluZyBjb250cm9sLlxuICogQHRoaXMge0ZpbHRlckxlYWZ9XG4gKi9cbmZ1bmN0aW9uIGNsZWFuVXBBbmRNb3ZlT24oZXZ0KSB7XG4gICAgdmFyIGVsID0gZXZ0LnRhcmdldDtcblxuICAgIC8vIHJlbW92ZSBgZXJyb3JgIENTUyBjbGFzcywgd2hpY2ggbWF5IGhhdmUgYmVlbiBhZGRlZCBieSBgRmlsdGVyTGVhZi5wcm90b3R5cGUuaW52YWxpZGBcbiAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdmaWx0ZXItdHJlZS1lcnJvcicpO1xuXG4gICAgLy8gc2V0IG9yIHJlbW92ZSAnd2FybmluZycgQ1NTIGNsYXNzLCBhcyBwZXIgZWwudmFsdWVcbiAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCk7XG5cbiAgICBpZiAoZWwgPT09IHRoaXMudmlldy5jb2x1bW4pIHtcbiAgICAgICAgLy8gcmVidWlsZCBvcGVyYXRvciBsaXN0IGFjY29yZGluZyB0byBzZWxlY3RlZCBjb2x1bW4gbmFtZSBvciB0eXBlLCByZXN0b3Jpbmcgc2VsZWN0ZWQgaXRlbVxuICAgICAgICBtYWtlT3BNZW51LmNhbGwodGhpcywgZWwudmFsdWUpO1xuICAgIH1cblxuICAgIGlmIChlbC52YWx1ZSkge1xuICAgICAgICAvLyBmaW5kIG5leHQgc2libGluZyBjb250cm9sLCBpZiBhbnlcbiAgICAgICAgaWYgKCFlbC5tdWx0aXBsZSkge1xuICAgICAgICAgICAgd2hpbGUgKChlbCA9IGVsLm5leHRFbGVtZW50U2libGluZykgJiYgKCEoJ25hbWUnIGluIGVsKSB8fCBlbC52YWx1ZS50cmltKCkgIT09ICcnKSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgY3VybHlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFuZCBjbGljayBpbiBpdCAob3BlbnMgc2VsZWN0IGxpc3QpXG4gICAgICAgIGlmIChlbCAmJiBlbC52YWx1ZS50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICBlbC52YWx1ZSA9ICcnOyAvLyByaWQgb2YgYW55IHdoaXRlIHNwYWNlXG4gICAgICAgICAgICBGaWx0ZXJOb2RlLmNsaWNrSW4oZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9yd2FyZCB0aGUgZXZlbnQgdG8gdGhlIGFwcGxpY2F0aW9uJ3MgZXZlbnQgaGFuZGxlclxuICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcikge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcihldnQpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBHZXQgdGhlIG5vZGUgcHJvcGVydHkuXG4gKiBAZGVzYyBQcmlvcml0eSBsYWRkZXI6XG4gKiAxLiBTY2hlbWEgcHJvcGVydHkuXG4gKiAyLiBNaXhpbiAoaWYgZ2l2ZW4pLlxuICogMy4gTm9kZSBwcm9wZXJ0eSBpcyBmaW5hbCBwcmlvcml0eS5cbiAqIEB0aGlzIHtGaWx0ZXJMZWFmfVxuICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eU5hbWVcbiAqIEBwYXJhbSB7ZnVuY3Rpb258Ym9vbGVhbn0gW21peGluXSAtIE9wdGlvbmFsIGZ1bmN0aW9uIG9yIHZhbHVlIGlmIHNjaGVtYSBwcm9wZXJ0eSB1bmRlZmluZWQuIElmIGZ1bmN0aW9uLCBjYWxsZWQgaW4gY29udGV4dCB3aXRoIGBwcm9wZXJ0eU5hbWVgIGFuZCBgY29sdW1uTmFtZWAuXG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICovXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eShjb2x1bW5OYW1lLCBwcm9wZXJ0eU5hbWUsIG1peGluKSB7XG4gICAgdmFyIGNvbHVtblNjaGVtYSA9IHRoaXMuc2NoZW1hLmxvb2t1cChjb2x1bW5OYW1lKSB8fCB7fTtcbiAgICByZXR1cm4gKFxuICAgICAgICBjb2x1bW5TY2hlbWFbcHJvcGVydHlOYW1lXSAvLyB0aGUgZXhwcmVzc2lvbidzIGNvbHVtbiBzY2hlbWEgcHJvcGVydHlcbiAgICAgICAgICAgIHx8XG4gICAgICAgIHR5cGVvZiBtaXhpbiA9PT0gJ2Z1bmN0aW9uJyAmJiBtaXhpbi5jYWxsKHRoaXMsIGNvbHVtblNjaGVtYSwgcHJvcGVydHlOYW1lKVxuICAgICAgICAgICAgfHxcbiAgICAgICAgdHlwZW9mIG1peGluICE9PSAnZnVuY3Rpb24nICYmIG1peGluXG4gICAgICAgICAgICB8fFxuICAgICAgICB0aGlzW3Byb3BlcnR5TmFtZV0gLy8gdGhlIGV4cHJlc3Npb24gbm9kZSdzIHByb3BlcnR5XG4gICAgKTtcbn1cblxuLyoqXG4gKiBAdGhpcyB7RmlsdGVyTGVhZn1cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfG1lbnVJdGVtW119XG4gKi9cbmZ1bmN0aW9uIGdldE9wTWVudShjb2x1bW5OYW1lKSB7XG4gICAgcmV0dXJuIGdldFByb3BlcnR5LmNhbGwodGhpcywgY29sdW1uTmFtZSwgJ29wTWVudScsIGZ1bmN0aW9uKGNvbHVtblNjaGVtYSkge1xuICAgICAgICByZXR1cm4gdGhpcy50eXBlT3BNYXAgJiYgdGhpcy50eXBlT3BNYXBbY29sdW1uU2NoZW1hLnR5cGUgfHwgdGhpcy50eXBlXTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBAdGhpcyB7RmlsdGVyTGVhZn1cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gKi9cbmZ1bmN0aW9uIG1ha2VPcE1lbnUoY29sdW1uTmFtZSkge1xuICAgIHZhciBvcE1lbnUgPSBnZXRPcE1lbnUuY2FsbCh0aGlzLCBjb2x1bW5OYW1lKTtcblxuICAgIGlmIChvcE1lbnUgIT09IHRoaXMucmVuZGVyZWRPcE1lbnUpIHtcbiAgICAgICAgdmFyIG5ld09wRHJvcCA9IHRoaXMubWFrZUVsZW1lbnQob3BNZW51LCAnb3BlcmF0b3InKTtcblxuICAgICAgICBuZXdPcERyb3AudmFsdWUgPSB0aGlzLnZpZXcub3BlcmF0b3IudmFsdWU7XG4gICAgICAgIHRoaXMuZWwucmVwbGFjZUNoaWxkKG5ld09wRHJvcCwgdGhpcy52aWV3Lm9wZXJhdG9yKTtcbiAgICAgICAgdGhpcy52aWV3Lm9wZXJhdG9yID0gbmV3T3BEcm9wO1xuXG4gICAgICAgIEZpbHRlck5vZGUuc2V0V2FybmluZ0NsYXNzKG5ld09wRHJvcCk7XG5cbiAgICAgICAgdGhpcy5yZW5kZXJlZE9wTWVudSA9IG9wTWVudTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNsaWNrSW4oZWwpIHtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKCdmaWx0ZXItdHJlZS1lcnJvcicpO1xuICAgICAgICBGaWx0ZXJOb2RlLmNsaWNrSW4oZWwpO1xuICAgIH0sIDApO1xufVxuXG5mdW5jdGlvbiBjb250cm9sVmFsdWUoZWwpIHtcbiAgICB2YXIgdmFsdWUsIGk7XG5cbiAgICBzd2l0Y2ggKGVsLnR5cGUpIHtcbiAgICAgICAgY2FzZSAnY2hlY2tib3gnOlxuICAgICAgICBjYXNlICdyYWRpbyc6XG4gICAgICAgICAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W25hbWU9XFwnJyArIGVsLm5hbWUgKyAnXFwnXTplbmFibGVkOmNoZWNrZWQnKTtcbiAgICAgICAgICAgIGZvciAodmFsdWUgPSBbXSwgaSA9IDA7IGkgPCBlbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhbHVlLnB1c2goZWxbaV0udmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSAnc2VsZWN0LW11bHRpcGxlJzpcbiAgICAgICAgICAgIGVsID0gZWwub3B0aW9ucztcbiAgICAgICAgICAgIGZvciAodmFsdWUgPSBbXSwgaSA9IDA7IGkgPCBlbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghZWwuZGlzYWJsZWQgJiYgZWwuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUucHVzaChlbFtpXS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHZhbHVlID0gZWwudmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG4vLyBNZWFudCB0byBiZSBjYWxsZWQgYnkgRmlsdGVyVHJlZS5wcm90b3R5cGUuc2V0U2Vuc2l0aXZpdHkgb25seVxuRmlsdGVyTGVhZi5zZXRUb1N0cmluZyA9IGZ1bmN0aW9uKGZuKSB7XG4gICAgdG9TdHJpbmcgPSBmbjtcbiAgICByZXR1cm4gQ29uZGl0aW9uYWxzLnNldFRvU3RyaW5nKGZuKTtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJMZWFmO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnZXh0ZW5kLW1lJyksIEJhc2UgPSBleHRlbmQuQmFzZTsgZXh0ZW5kLmRlYnVnID0gdHJ1ZTtcbnZhciBwb3BNZW51ID0gcmVxdWlyZSgncG9wLW1lbnUnKTtcblxudmFyIGNzc0luamVjdG9yID0gcmVxdWlyZSgnLi9zdHlsZXNoZWV0Jyk7XG52YXIgVGVtcGxhdGVzID0gcmVxdWlyZSgnLi9UZW1wbGF0ZXMnKTtcbnZhciBDb25kaXRpb25hbHMgPSByZXF1aXJlKCcuL0NvbmRpdGlvbmFscycpO1xudmFyIFBhcnNlclNRTCA9IHJlcXVpcmUoJy4vcGFyc2VyLVNRTCcpO1xuXG5cbnZhciBDSElMRFJFTl9UQUcgPSAnT0wnLFxuICAgIENISUxEX1RBRyA9ICdMSSc7XG5cbi8vIEpTT04tZGV0ZWN0b3I6IGJlZ2lucyBfYW5kXyBlbmRzIHdpdGggZWl0aGVyIFsgYW5kIF0gX29yXyB7IGFuZCB9XG52YXIgcmVKU09OID0gL15cXHMqKChcXFtbXl0qXFxdKXwoXFx7W15dKlxcfSkpXFxzKiQvO1xuXG5mdW5jdGlvbiBGaWx0ZXJUcmVlRXJyb3IobWVzc2FnZSwgbm9kZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbn1cbkZpbHRlclRyZWVFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5GaWx0ZXJUcmVlRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnRmlsdGVyVHJlZUVycm9yJztcblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3RcbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtzeW50YXg9J2F1dG8nXSAtIFNwZWNpZnkgcGFyc2VyIHRvIHVzZSBvbiBgc3RhdGVgLiBPbmUgb2Y6XG4gKiAqIGAnYXV0bydgIC0gQXV0by1kZXRlY3Q7IHNlZSB7QGxpbmsgRmlsdGVyTm9kZSNwYXJzZVN0YXRlU3RyaW5nfSBmb3IgYWxnb3JpdGhtLlxuICogKiBgJ29iamVjdCdgIC0gQSByYXcgc3RhdGUgb2JqZWN0IHN1Y2ggYXMgdGhhdCBwcm9kdWNlZCBieSB0aGUgW2dldFN0YXRlKClde0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV9IG1ldGhvZC5cbiAqICogYCdKU09OJ2AgLSBBIEpTT04gc3RyaW5nIHZlcnNpb24gb2YgYSBzdGF0ZSBvYmplY3Qgc3VjaCBhcyB0aGF0IHByb2R1Y2VkIGJ5IHRoZSBbZ2V0U3RhdGUoKV17QGxpbmsgRmlsdGVyVHJlZSNnZXRTdGF0ZX0gbWV0aG9kLlxuICogKiBgJ1NRTCdgIC0gQSBTUUwgW3NlYXJjaCBjb25kaXRpb24gZXhwcmVzc2lvbl17QGxpbmsgaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczE3MzU0NS5hc3B4fSBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBbY29udGV4dF0gSWYgZGVmaW5lZCwgdGhlIHByb3ZpZGVkIGlucHV0IHN0cmluZyBpcyB1c2VkIGFzIGEgc2VsZWN0b3IgdG8gYW4gYEhUTUxFbGVtZW50YCBjb250YWluZWQgaW4gYGNvbnRleHRgLiBUaGUgYHZhbHVlYCBwcm9wZXJ0eSBvZiB0aGlzIGVsZW1lbnQgaXMgZmV0Y2hlZCBmcm9tIHRoZSBET00gYW5kIGlzIHVzZWQgYXMgdGhlIGlucHV0IHN0YXRlIHN0cmluZzsgcHJvY2VlZCBhcyBhYm92ZS5cbiAqL1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gRmlsdGVyVHJlZU9wdGlvbnNPYmplY3RcbiAqXG4gKiBAcHJvcGVydHkge21lbnVJdGVtW119IFtzY2hlbWFdIC0gQSBkZWZhdWx0IGxpc3Qgb2YgY29sdW1uIG5hbWVzIGZvciBmaWVsZCBkcm9wLWRvd25zIG9mIGFsbCBkZXNjZW5kYW50IHRlcm1pbmFsIG5vZGVzLiBPdmVycmlkZXMgYG9wdGlvbnMuc3RhdGUuc2NoZW1hYCAoc2VlKS4gTWF5IGJlIGRlZmluZWQgZm9yIGFueSBub2RlIGFuZCBwZXJ0YWlucyB0byBhbGwgZGVzY2VuZGFudHMgb2YgdGhhdCBub2RlIChpbmNsdWRpbmcgdGVybWluYWwgbm9kZXMpLiBJZiBvbWl0dGVkIChhbmQgbm8gYG93blNjaGVtYWApLCB3aWxsIHVzZSB0aGUgbmVhcmVzdCBhbmNlc3RvciBgc2NoZW1hYCBkZWZpbml0aW9uLiBIb3dldmVyLCBkZXNjZW5kYW50cyB3aXRoIHRoZWlyIG93biBkZWZpbml0aW9uIG9mIGB0eXBlc2Agd2lsbCBvdmVycmlkZSBhbnkgYW5jZXN0b3IgZGVmaW5pdGlvbi5cbiAqXG4gKiA+IFR5cGljYWxseSBvbmx5IHVzZWQgYnkgdGhlIGNhbGxlciBmb3IgdGhlIHRvcC1sZXZlbCAocm9vdCkgdHJlZS5cbiAqXG4gKiBAcHJvcGVydHkge21lbnVJdGVtW119IFtvd25TY2hlbWFdIC0gQSBkZWZhdWx0IGxpc3Qgb2YgY29sdW1uIG5hbWVzIGZvciBmaWVsZCBkcm9wLWRvd25zIG9mIGltbWVkaWF0ZSBkZXNjZW5kYW50IHRlcm1pbmFsIG5vZGVzIF9vbmx5Xy4gT3ZlcnJpZGVzIGBvcHRpb25zLnN0YXRlLm93blNjaGVtYWAgKHNlZSkuXG4gKlxuICogQWx0aG91Z2ggYm90aCBgb3B0aW9ucy5zY2hlbWFgIGFuZCBgb3B0aW9ucy5vd25TY2hlbWFgIGFyZSBub3RhdGVkIGFzIG9wdGlvbmFsIGhlcmVpbiwgYnkgdGhlIHRpbWUgYSB0ZXJtaW5hbCBub2RlIHRyaWVzIHRvIHJlbmRlciBhIHNjaGVtYSBkcm9wLWRvd24sIGEgYHNjaGVtYWAgbGlzdCBzaG91bGQgYmUgZGVmaW5lZCB0aHJvdWdoIChpbiBvcmRlciBvZiBwcmlvcml0eSk6XG4gKlxuICogKiBUZXJtaW5hbCBub2RlJ3Mgb3duIGBvcHRpb25zLnNjaGVtYWAgKG9yIGBvcHRpb25zLnN0YXRlLnNjaGVtYWApIGRlZmluaXRpb24uXG4gKiAqIFRlcm1pbmFsIG5vZGUncyBwYXJlbnQgbm9kZSdzIGBvcHRpb24ub3duU2NoZW1hYCAob3IgYG9wdGlvbi5zdGF0ZS5ub2Rlc0ZpZWxkc2ApIGRlZmluaXRpb24uXG4gKiAqIFRlcm1pbmFsIG5vZGUncyBwYXJlbnQgKG9yIGFueSBhbmNlc3Rvcikgbm9kZSdzIGBvcHRpb25zLnNjaGVtYWAgKG9yIGBvcHRpb25zLnN0YXRlLnNjaGVtYWApIGRlZmluaXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IFtzdGF0ZV0gLSBBIGRhdGEgc3RydWN0dXJlIHRoYXQgZGVzY3JpYmVzIGEgdHJlZSwgc3VidHJlZSwgb3IgbGVhZiAodGVybWluYWwgbm9kZSkuIElmIHVuZGVmaW5lZCwgbG9hZHMgYW4gZW1wdHkgZmlsdGVyLCB3aGljaCBpcyBhIGBGaWx0ZXJUcmVlYCBub2RlIGNvbnNpc3RpbmcgdGhlIGRlZmF1bHQgYG9wZXJhdG9yYCB2YWx1ZSAoYCdvcC1hbmQnYCkuXG4gKlxuICogQHByb3BlcnR5IHtmdW5jdGlvbn0gW2VkaXRvcj0nRGVmYXVsdCddIC0gVGhlIG5hbWUgb2YgdGhlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24ncyBVSSBcImVkaXRvci5cIiBUaGlzIG5hbWUgbXVzdCBiZSByZWdpc3RlcmVkIGluIHRoZSBwYXJlbnQgbm9kZSdzIHtAbGluayBGaWx0ZXJUcmVlI2VkaXRvcnN8ZWRpdG9yc30gaGFzaCwgd2hlcmUgaXQgbWFwcyB0byBhIGxlYWYgY29uc3RydWN0b3IgKGBGaWx0ZXJMZWFmYCBvciBhIGRlc2NlbmRhbnQgdGhlcmVvZikuIChVc2Uge0BsaW5rIEZpbHRlclRyZWUjYWRkRWRpdG9yfSB0byByZWdpc3RlciBuZXcgZWRpdG9ycy4pXG4gKlxuICogQHByb3BlcnR5IHtGaWx0ZXJUcmVlfSBbcGFyZW50XSAtIFVzZWQgaW50ZXJuYWxseSB0byBpbnNlcnQgZWxlbWVudCB3aGVuIGNyZWF0aW5nIG5lc3RlZCBzdWJ0cmVlcy4gVGhlIG9ubHkgdGltZSBpdCBtYXkgYmUgKGFuZCBtdXN0IGJlKSBvbWl0dGVkIGlzIHdoZW4gY3JlYXRpbmcgdGhlIHJvb3Qgbm9kZS5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ3xIVE1MRWxlbWVudH0gW2Nzc1N0eWxlc2hlZXRSZWZlcmVuY2VFbGVtZW50XSAtIHBhc3NlZCB0byBjc3NJbnNlcnRcbiAqL1xuXG4vKiogQHR5cGVkZWYge29iamVjdHxzdHJpbmd9IEZpbHRlclRyZWVTdGF0ZU9iamVjdFxuICpcbiAqIEBzdW1tYXJ5IFN0YXRlIHdpdGggd2hpY2ggdG8gY3JlYXRlIGEgbmV3IG5vZGUgb3IgcmVwbGFjZSBhbiBleGlzdGluZyBub2RlLlxuICpcbiAqIEBkZXNjIEEgc3RyaW5nIG9yIHBsYWluIG9iamVjdCB0aGF0IGRlc2NyaWJlcyBhIGZpbHRlci10cmVlIG5vZGUuIElmIGEgc3RyaW5nLCBpdCBpcyBwYXJzZWQgaW50byBhbiBvYmplY3QgYnkge0BsaW5rIEZpbHRlck5vZGV+cGFyc2VTdGF0ZVN0cmluZ30uIChTZWUsIGZvciBhdmFpbGFibGUgb3ZlcmxvYWRzLilcbiAqXG4gKiBUaGUgcmVzdWx0aW5nIG9iamVjdCBtYXkgYmUgYSBmbGF0IG9iamVjdCB0aGF0IGRlc2NyaWJlcyBhIHRlcm1pbmFsIG5vZGUgb3IgYSBjaGlsZGxlc3Mgcm9vdCBvciBicmFuY2ggbm9kZTsgb3IgbWF5IGJlIGEgaGllcmFyY2hpY2FsIG9iamVjdCB0byBkZWZpbmUgYW4gZW50aXJlIHRyZWUgb3Igc3VidHJlZS5cbiAqXG4gKiBJbiBhbnkgY2FzZSwgdGhlIHJlc3VsdGluZyBvYmplY3QgbWF5IGhhdmUgYW55IG9mIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAqXG4gKiBAcHJvcGVydHkge21lbnVJdGVtW119IFtzY2hlbWFdIC0gU2VlIGBzY2hlbWFgIHByb3BlcnR5IG9mIHtAbGluayBGaWx0ZXJUcmVlT3B0aW9uc09iamVjdH0uXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtlZGl0b3I9J0RlZmF1bHQnXSAtIFNlZSBgZWRpdG9yYCBwcm9wZXJ0eSBvZiB7QGxpbmsgRmlsdGVyVHJlZU9wdGlvbnNPYmplY3R9LlxuICpcbiAqIEBwcm9wZXJ0eSBtaXNjIC0gT3RoZXIgbWlzY2VsbGFuZW91cyBwcm9wZXJ0aWVzIHdpbGwgYmUgY29waWVkIGRpcmVjdGx5IHRvIHRoZSBuZXcgYEZpdGxlck5vZGVgIG9iamVjdC4gKFRoZSBuYW1lIFwibWlzY1wiIGhlcmUgaXMganVzdCBhIHN0YW5kLWluOyB0aGVyZSBpcyBubyBzcGVjaWZpYyBwcm9wZXJ0eSBjYWxsZWQgXCJtaXNjXCIuKVxuICpcbiAqICogTWF5IGRlc2NyaWJlIGEgbm9uLXRlcm1pbmFsIG5vZGUgd2l0aCBwcm9wZXJ0aWVzOlxuICogICAqIGBzY2hlbWFgIC0gT3ZlcnJpZGRlbiBvbiBpbnN0YW50aWF0aW9uIGJ5IGBvcHRpb25zLnNjaGVtYWAuIElmIGJvdGggdW5zcGVjaWZpZWQsIHVzZXMgcGFyZW50J3MgZGVmaW5pdGlvbi5cbiAqICAgKiBgb3BlcmF0b3JgIC0gT25lIG9mIHtAbGluayB0cmVlT3BlcmF0b3JzfS5cbiAqICAgKiBgY2hpbGRyZW5gIC0gIEFycmF5IGNvbnRhaW5pbmcgYWRkaXRpb25hbCB0ZXJtaW5hbCBhbmQgbm9uLXRlcm1pbmFsIG5vZGVzLlxuICpcbiAqIFRoZSBjb25zdHJ1Y3RvciBhdXRvLWRldGVjdHMgYHN0YXRlYCdzIHR5cGU6XG4gKiAgKiBKU09OIHN0cmluZyB0byBiZSBwYXJzZWQgYnkgYEpTT04ucGFyc2UoKWAgaW50byBhIHBsYWluIG9iamVjdFxuICogICogU1FMIFdIRVJFIGNsYXVzZSBzdHJpbmcgdG8gYmUgcGFyc2VkIGludG8gYSBwbGFpbiBvYmplY3RcbiAqICAqIENTUyBzZWxlY3RvciBvZiBhbiBFbGVtZW50IHdob3NlIGB2YWx1ZWAgY29udGFpbnMgb25lIG9mIHRoZSBhYm92ZVxuICogICogcGxhaW4gb2JqZWN0XG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAc3VtbWFyeSBBIG5vZGUgaW4gYSBmaWx0ZXIgdHJlZS5cbiAqXG4gKiBAZGVzY3JpcHRpb24gQSBmaWx0ZXIgdHJlZSByZXByZXNlbnRzIGEgX2NvbXBsZXggY29uZGl0aW9uYWwgZXhwcmVzc2lvbl8gYW5kIGNvbnNpc3RzIG9mIGEgc2luZ2xlIGluc3RhbmNlIG9mIGEge0BsaW5rIEZpbHRlclRyZWV9IG9iamVjdCBhcyB0aGUgX3Jvb3RfIG9mIGFuIF9uXy1hcnkgdHJlZS5cbiAqXG4gKiBGaWx0ZXIgdHJlZXMgYXJlIGNvbXByaXNlZCBvZiBpbnN0YW5jZXMgb2YgYEZpbHRlck5vZGVgIG9iamVjdHMuIEhvd2V2ZXIsIHRoZSBgRmlsdGVyTm9kZWAgY29uc3RydWN0b3IgaXMgYW4gXCJhYnN0cmFjdCBjbGFzc1wiOyBmaWx0ZXIgbm9kZSBvYmplY3RzIGFyZSBuZXZlciBpbnN0YW50aWF0ZWQgZGlyZWN0bHkgZnJvbSB0aGlzIGNvbnN0cnVjdG9yLiBBIGZpbHRlciB0cmVlIGlzIGFjdHVhbGx5IGNvbXByaXNlZCBvZiBpbnN0YW5jZXMgb2YgdHdvIFwic3ViY2xhc3Nlc1wiIG9mIGBGaWx0ZXJOb2RlYCBvYmplY3RzOlxuICogKiB7QGxpbmsgRmlsdGVyVHJlZX0gKG9yIHN1YmNsYXNzIHRoZXJlb2YpIG9iamVjdHMsIGluc3RhbmNlcyBvZiB3aGljaCByZXByZXNlbnQgdGhlIHJvb3Qgbm9kZSBhbmQgYWxsIHRoZSBicmFuY2ggbm9kZXM6XG4gKiAgICogVGhlcmUgaXMgYWx3YXlzIGV4YWN0bHkgb25lIHJvb3Qgbm9kZSwgY29udGFpbmluZyB0aGUgd2hvbGUgZmlsdGVyIHRyZWUsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGZpbHRlciBleHByZXNzaW9uIGluIGl0cyBlbnRpcmV0eS4gVGhlIHJvb3Qgbm9kZSBpcyBkaXN0aW5ndWlzaGVkIGJ5IGhhdmluZyBubyBwYXJlbnQgbm9kZS5cbiAqICAgKiBUaGVyZSBhcmUgemVybyBvciBtb3JlIGJyYW5jaCBub2Rlcywgb3Igc3VidHJlZXMsIHdoaWNoIGFyZSBjaGlsZCBub2RlcyBvZiB0aGUgcm9vdCBvciBvdGhlciBicmFuY2hlcyBoaWdoZXIgdXAgaW4gdGhlIHRyZWUsIHJlcHJlc2VudGluZyBzdWJleHByZXNzaW9ucyB3aXRoaW4gdGhlIGxhcmdlciBmaWx0ZXIgZXhwcmVzc2lvbi4gRWFjaCBicmFuY2ggbm9kZSBoYXMgZXhhY3RseSBvbmUgcGFyZW50IG5vZGUuXG4gKiAgICogVGhlc2Ugbm9kZXMgcG9pbnQgdG8gemVybyBvciBtb3JlIGNoaWxkIG5vZGVzIHdoaWNoIGFyZSBlaXRoZXIgbmVzdGVkIHN1YnRyZWVzLCBvcjpcbiAqICoge0BsaW5rIEZpbHRlckxlYWZ9IChvciBzdWJjbGFzcyB0aGVyZW9mKSBvYmplY3RzLCBlYWNoIGluc3RhbmNlIG9mIHdoaWNoIHJlcHJlc2VudHMgYSBzaW5nbGUgc2ltcGxlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24uIFRoZXNlIGFyZSB0ZXJtaW5hbCBub2RlcywgaGF2aW5nIGV4YWN0bHkgb25lIHBhcmVudCBub2RlLCBhbmQgbm8gY2hpbGQgbm9kZXMuXG4gKlxuICogVGhlIHByb2dyYW1tZXIgbWF5IGV4dGVuZCB0aGUgc2VtYW50aWNzIG9mIGZpbHRlciB0cmVlcyBieSBleHRlbmRpbmcgdGhlIGFib3ZlIG9iamVjdHMuXG4gKlxuICogQHByb3BlcnR5IHtzcWxJZFF0c09iamVjdH0gW3NxbElkUXRzPXtiZWc6J1wiJyxlbmQ6J1wiJ31dIC0gUXVvdGUgY2hhcmFjdGVycyBmb3IgU1FMIGlkZW50aWZpZXJzLiBVc2VkIGZvciBib3RoIHBhcnNpbmcgYW5kIGdlbmVyYXRpbmcgU1FMLiBTaG91bGQgYmUgcGxhY2VkIG9uIHRoZSByb290IG5vZGUuXG4gKlxuICogQHByb3BlcnR5IHtIVE1MRWxlbWVudH0gZWwgLSBUaGUgRE9NIGVsZW1lbnQgY3JlYXRlZCBieSB0aGUgYHJlbmRlcmAgbWV0aG9kIHRvIHJlcHJlc2VudCB0aGlzIG5vZGUuIENvbnRhaW5zIHRoZSBgZWxgcyBmb3IgYWxsIGNoaWxkIG5vZGVzICh3aGljaCBhcmUgdGhlbXNlbHZlcyBwb2ludGVkIHRvIGJ5IHRob3NlIG5vZGVzKS4gVGhpcyBpcyBhbHdheXMgZ2VuZXJhdGVkIGJ1dCBpcyBvbmx5IGluIHRoZSBwYWdlIERPTSBpZiB5b3UgcHV0IGl0IHRoZXJlLlxuICovXG5cbnZhciBGaWx0ZXJOb2RlID0gQmFzZS5leHRlbmQoJ0ZpbHRlck5vZGUnLCB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBDcmVhdGUgYSBuZXcgbm9kZSBvciBzdWJ0cmVlLlxuICAgICAqIEBkZXNjIFR5cGljYWxseSB1c2VkIGJ5IHRoZSBhcHBsaWNhdGlvbiBsYXllciB0byBjcmVhdGUgdGhlIGVudGlyZSBmaWx0ZXIgdHJlZTsgYW5kIGludGVybmFsbHksIHJlY3Vyc2l2ZWx5LCB0byBjcmVhdGUgZWFjaCBub2RlIGluY2x1ZGluZyBib3RoIHN1YnRyZWVzIGFuZCBsZWF2ZXMuXG4gICAgICpcbiAgICAgKiAqKk5vZGUgcHJvcGVydGllcyBhbmQgb3B0aW9uczoqKiBOb2RlcyBhcmUgaW5zdGFudGlhdGVkIHdpdGg6XG4gICAgICogMS4gQ2VydGFpbiAqKnJlcXVpcmVkIHByb3BlcnRpZXMqKiB3aGljaCBkaWZmZXIgZm9yIHN1YnRyZWVzIGFuZCBsZWF2ZXMuXG4gICAgICogMi4gQXJiaXRyYXJ5ICoqbm9uLXN0YW5kYXJkIG9wdGlvbiBwcm9wZXJ0aWVzKiogYXJlIGRlZmluZWQgb24gdGhlIGBvcHRpb25zYCBvYmplY3QgKHNvIGxvbmcgYXMgdGhlaXIgbmFtZXMgZG8gbm90IGNvbmZsaWN0IHdpdGggYW55IHN0YW5kYXJkIG9wdGlvbnMpIGFuZCBuZXZlciBwZXJzaXN0LlxuICAgICAqIDMuIENlcnRhaW4gKipzdGFuZGFyZCBvcHRpb25zIHByb3BlcnRpZXMqKiBhcyBkZWZpbmVkIGluIHRoZSB7QGxpbmsgRmlsdGVyTm9kZX5vcHRpb25zU2NoZW1hfG9wdGlvbnNTY2hlbWF9IGhhc2gsIGNvbWUgZnJvbSB2YXJpb3VzIHNvdXJjZXMsIGFzIHByaW9yaXRpemVkIGFzIGZvbGxvd3M6XG4gICAgICogICAgMS4gYG9wdGlvbnNgIG9iamVjdDsgZG9lcyBub3QgcGVyc2lzdFxuICAgICAqICAgIDIuIGBzdGF0ZWA7IG9iamVjdDsgcGVyc2lzdHNcbiAgICAgKiAgICAzLiBgcGFyZW50YCBvYmplY3Q7IHBlcnNpc3RzXG4gICAgICogICAgNC4gYGRlZmF1bHRgIG9iamVjdDsgZG9lcyBub3QgcGVyc2lzdFxuICAgICAqXG4gICAgICogTm90ZXM6XG4gICAgICogMS4gXCJQZXJzaXN0c1wiIG1lYW5zIG91dHB1dCBieSB7QGxpbmsgRmlsdGVyVHJlZSNnZXRTdGF0ZXxnZXRTdGF0ZSgpfS5cbiAgICAgKiAyLiBUaGUgYHBhcmVudGAgb2JqZWN0IGlzIGdlbmVyYXRlZCBpbnRlcm5hbGx5IGZvciBzdWJ0cmVlcy4gSXQgYWxsb3dzIHN0YW5kYXJkIG9wdGlvbnMgdG8gaW5oZXJpdCBmcm9tIHRoZSBwYXJlbnQgbm9kZS5cbiAgICAgKiAzLiBUaGUgYGRlZmF1bHRgIG9iamVjdCBjb21lcyBmcm9tIHRoZSBgZGVmYXVsdGAgcHJvcGVydHksIGlmIGFueSwgb2YgdGhlIHtAbGluayBGaWx0ZXJOb2Rlfm9wdGlvbnNTY2hlbWF8c2NoZW1hIG9iamVjdH0gZm9yIHRoZSBzdGFuZGFyZCBvcHRpb24gaW4gcXVlc3Rpb24uIE5vdGUgdGhhdCBvbmNlIGRlZmluZWQsIHN1YnRyZWVzIHdpbGwgdGhlbiBpbmhlcml0IHRoaXMgdmFsdWUuXG4gICAgICogNC4gSWYgbm90IGRlZmluZWQgYnkgYW55IG9mIHRoZSBhYm92ZSwgdGhlIHN0YW5kYXJkIG9wdGlvbiByZW1haW5zIHVuZGVmaW5lZCBvbiB0aGUgbm9kZS5cbiAgICAgKlxuICAgICAqICoqUXVlcnkgQnVpbGRlciBVSSBzdXBwb3J0OioqIElmIHlvdXIgYXBwIHdhbnRzIHRvIG1ha2UgdXNlIG9mIHRoZSBnZW5lcmF0ZWQgVUksIHlvdSBhcmUgcmVzcG9uc2libGUgZm9yIGluc2VydGluZyB0aGUgdG9wLWxldmVsIGAuZWxgIGludG8gdGhlIERPTS4gKE90aGVyd2lzZSBqdXN0IGlnbm9yZSBpdC4pXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgbm9kZSBzdGF0ZTsgb3IgYW4gb3B0aW9ucyBvYmplY3QgcG9zc2libHkgY29udGFpbmluZyBgc3RhdGVgIGFtb25nIG90aGVyIG9wdGlvbnMuIEFsdGhvdWdoIHlvdSBjYW4gaW5zdGFudGlhdGUgYSBmaWx0ZXIgd2l0aG91dCBhbnkgb3B0aW9ucywgdGhpcyBpcyBnZW5lcmFsbHkgbm90IHVzZWZ1bC4gU2VlICpJbnN0YW50aWF0aW5nIGEgZmlsdGVyKiBpbiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2luZGV4Lmh0bWx8cmVhZG1lfSBmb3IgYSBwcmFjdGljYWwgZGlzY3Vzc2lvbiBvZiBtaW5pbXVtIG9wdGlvbnMuXG4gICAgICpcbiAgICAgKiAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqL1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgLyoqIEBzdW1tYXJ5IFJlZmVyZW5jZSB0byB0aGlzIG5vZGUncyBwYXJlbnQgbm9kZS5cbiAgICAgICAgICogQGRlc2MgV2hlbiB0aGlzIHByb3BlcnR5IGlzIHVuZGVmaW5lZCwgdGhpcyBub2RlIGlzIHRoZSByb290IG5vZGUuXG4gICAgICAgICAqIEB0eXBlIHtGaWx0ZXJOb2RlfVxuICAgICAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgICAgICovXG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IG9wdGlvbnMucGFyZW50LFxuICAgICAgICAgICAgcm9vdCA9IHBhcmVudCAmJiBwYXJlbnQucm9vdDtcblxuICAgICAgICBpZiAoIXJvb3QpIHtcbiAgICAgICAgICAgIHJvb3QgPSB0aGlzO1xuXG4gICAgICAgICAgICB0aGlzLnN0eWxlc2hlZXQgPSB0aGlzLnN0eWxlc2hlZXQgfHxcbiAgICAgICAgICAgICAgICBjc3NJbmplY3RvcihvcHRpb25zLmNzc1N0eWxlc2hlZXRSZWZlcmVuY2VFbGVtZW50KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbHMgPSBuZXcgQ29uZGl0aW9uYWxzKG9wdGlvbnMpOyAvLyAuc3FsSWRRdHNcblxuICAgICAgICAgICAgdGhpcy5QYXJzZXJTUUwgPSBuZXcgUGFyc2VyU1FMKG9wdGlvbnMpOyAvLyAuc2NoZW1hLCAuY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzLCAucmVzb2x2ZUFsaWFzZXNcblxuICAgICAgICAgICAgdmFyIGtleXMgPSBbJ25hbWUnXTtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnJlc29sdmVBbGlhc2VzKSB7XG4gICAgICAgICAgICAgICAga2V5cy5wdXNoKCdhbGlhcycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmZpbmRPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGNhc2VTZW5zaXRpdmU6IG9wdGlvbnMuY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzLFxuICAgICAgICAgICAgICAgIGtleXM6IGtleXNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvKiogQHN1bW1hcnkgQ29udmVuaWVuY2UgcmVmZXJlbmNlIHRvIHRoZSByb290IG5vZGUuXG4gICAgICAgICAqIEBuYW1lIHJvb3RcbiAgICAgICAgICogQHR5cGUge0ZpbHRlck5vZGV9XG4gICAgICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yb290ID0gcm9vdDtcblxuICAgICAgICB0aGlzLmRvbnRQZXJzaXN0ID0ge307IC8vIGhhc2ggb2YgdHJ1dGh5IHZhbHVlc1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUob3B0aW9ucy5zdGF0ZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKiBJbnNlcnQgZWFjaCBzdWJ0cmVlIGludG8gaXRzIHBhcmVudCBub2RlIGFsb25nIHdpdGggYSBcImRlbGV0ZVwiIGJ1dHRvbi5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoZSByb290IHRyZWUgKHdoaWNoIGhhcyBubyBwYXJlbnQpIG11c3QgYmUgaW5zZXJ0ZWQgaW50byB0aGUgRE9NIGJ5IHRoZSBpbnN0YW50aWF0aW5nIGNvZGUgKHdpdGhvdXQgYSBkZWxldGUgYnV0dG9uKS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgICAgICAgIHZhciBuZXdMaXN0SXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoQ0hJTERfVEFHKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubm90ZXNFbCkge1xuICAgICAgICAgICAgICAgIG5ld0xpc3RJdGVtLmFwcGVuZENoaWxkKHRoaXMubm90ZXNFbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5rZWVwKSB7XG4gICAgICAgICAgICAgICAgdmFyIGVsID0gdGhpcy50ZW1wbGF0ZXMuZ2V0KCdyZW1vdmVCdXR0b24nKTtcbiAgICAgICAgICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMucmVtb3ZlLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgICAgIG5ld0xpc3RJdGVtLmFwcGVuZENoaWxkKGVsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3TGlzdEl0ZW0uYXBwZW5kQ2hpbGQodGhpcy5lbCk7XG5cbiAgICAgICAgICAgIHRoaXMucGFyZW50LmVsLnF1ZXJ5U2VsZWN0b3IoQ0hJTERSRU5fVEFHKS5hcHBlbmRDaGlsZChuZXdMaXN0SXRlbSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqL1xuICAgIHNldFN0YXRlOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgb2xkRWwgPSB0aGlzLmVsO1xuXG4gICAgICAgIHN0YXRlID0gdGhpcy5wYXJzZVN0YXRlU3RyaW5nKHN0YXRlLCBvcHRpb25zKTtcblxuICAgICAgICB0aGlzLm1peEluU3RhbmRhcmRPcHRpb25zKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5taXhJbk5vbnN0YW5kYXJkT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdGhpcy5jcmVhdGVWaWV3KHN0YXRlKTtcbiAgICAgICAgdGhpcy5sb2FkU3RhdGUoc3RhdGUpO1xuICAgICAgICB0aGlzLnJlbmRlcigpO1xuXG4gICAgICAgIGlmIChvbGRFbCkge1xuICAgICAgICAgICAgdmFyIG5ld0VsID0gdGhpcy5lbDtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudCAmJiBvbGRFbC5wYXJlbnRFbGVtZW50LnRhZ05hbWUgPT09ICdMSScpIHtcbiAgICAgICAgICAgICAgICBvbGRFbCA9IG9sZEVsLnBhcmVudE5vZGU7XG4gICAgICAgICAgICAgICAgbmV3RWwgPSBuZXdFbC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb2xkRWwucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3RWwsIG9sZEVsKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBDb252ZXJ0IGEgc3RyaW5nIHRvIGEgc3RhdGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogQGRlc2MgVGhleSBzdHJpbmcncyBzeW50YXggaXMgaW5mZXJyZWQgYXMgZm9sbG93czpcbiAgICAgKiAxLiBJZiBzdGF0ZSBpcyB1bmRlZmluZWQgb3IgYWxyZWFkeSBhbiBvYmplY3QsIHJldHVybiBhcyBpcy5cbiAgICAgKiAyLiBJZiBgb3B0aW9ucy5jb250ZXh0YCBpcyBkZWZpbmVkLCBgc3RhdGVgIGlzIGFzc3VtZWQgdG8gYmUgYSBDU1Mgc2VsZWN0b3Igc3RyaW5nIChhdXRvLWRldGVjdGVkKSBwb2ludGluZyB0byBhbiBIVE1MIGZvcm0gY29udHJvbCB3aXRoIGEgYHZhbHVlYCBwcm9wZXJ0eSwgc3VjaCBhcyBhIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvSFRNTElucHV0RWxlbWVudCBIVE1MSW5wdXRFbGVtZW50fSBvciBhIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvSFRNTFRleHRBcmVhRWxlbWVudCBIVE1MVGV4dEFyZWFFbGVtZW50fS4gVGhlIGVsZW1lbnQgaXMgc2VsZWN0ZWQgYW5kIGlmIGZvdW5kLCBpdHMgdmFsdWUgaXMgZmV0Y2hlZCBmcm9tIHRoZSBET00gYW5kIGFzc2lnbmVkIHRvIGBzdGF0ZWAuXG4gICAgICogMy4gSWYgYG9wdGlvbnMuc3ludGF4YCBpcyBgJ2F1dG8nYCwgSlNPTiBzeW50YXggaXMgZGV0ZWN0ZWQgaWYgYHN0YXRlYCBiZWdpbnMgX2FuZF8gZW5kcyB3aXRoIGVpdGhlciBgW2AgYW5kIGBdYCBfb3JfIGB7YCBhbmQgYH1gIChpZ25vcmluZyBsZWFkaW5nIGFuZCB0cmFpbGluZyB3aGl0ZSBzcGFjZSkuXG4gICAgICogNC4gSWYgSlNPTiBzeW50YXgsIHBhcnNlIHRoZSBzdHJpbmcgaW50byBhbiBhY3R1YWwgYEZpbHRlclRyZWVTdGF0ZU9iamVjdGAgdXNpbmcge0BsaW5rIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0pTT04vcGFyc2V8SlNPTi5wYXJzZX0gYW5kIHRocm93IGFuIGVycm9yIGlmIHVucGFyc2FibGUuXG4gICAgICogNS4gSWYgbm90IEpTT04sIHBhcnNlIHRoZSBzdHJpbmcgYXMgU1FMIGludG8gYW4gYWN0dWFsIGBGaWx0ZXJUcmVlU3RhdGVPYmplY3RgIHVzaW5nIHBhcnNlci1TUUwncyB7QGxpbmsgUGFyc2VyU1FMI3BhcnNlcnxwYXJzZXJ9IGFuZCB0aHJvdyBhbiBlcnJvciBpZiB1bnBhcnNhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IFtzdGF0ZV1cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH0gVGhlIHVubW9sZXN0ZWQgYHN0YXRlYCBwYXJhbWV0ZXIuIFRocm93cyBhbiBlcnJvciBpZiBgc3RhdGVgIGlzIHVua25vd24gb3IgaW52YWxpZCBzeW50YXguXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAaW5uZXJcbiAgICAgKi9cbiAgICBwYXJzZVN0YXRlU3RyaW5nOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFyIGNvbnRleHQgPSBvcHRpb25zICYmIG9wdGlvbnMuY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgc3ludGF4ID0gb3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCB8fCAnYXV0byc7IC8vIGRlZmF1bHQgaXMgJ2F1dG8nXG5cbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IGNvbnRleHQucXVlcnlTZWxlY3RvcihzdGF0ZSkudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHN5bnRheCA9PT0gJ2F1dG8nKSB7XG4gICAgICAgICAgICAgICAgICAgIHN5bnRheCA9IHJlSlNPTi50ZXN0KHN0YXRlKSA/ICdKU09OJyA6ICdTUUwnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3ludGF4KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ0pTT04nOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IEpTT04ucGFyc2Uoc3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRmlsdGVyVHJlZUVycm9yKCdKU09OIHBhcnNlcjogJyArIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdTUUwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMucm9vdC5QYXJzZXJTUUwucGFyc2Uoc3RhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRmlsdGVyVHJlZUVycm9yKCdTUUwgV0hFUkUgY2xhdXNlIHBhcnNlcjogJyArIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGF0ZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRmlsdGVyVHJlZUVycm9yKCdVbmV4cGVjdGVkIGlucHV0IHN0YXRlLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgZWFjaCBzdGFuZGFyZCBvcHRpb24gZnJvbSB3aGVuIGZvdW5kIG9uIHRoZSBgb3B0aW9uc2Agb3IgYHN0YXRlYCBvYmplY3RzLCByZXNwZWN0aXZlbHk7IG9yIGlmIG5vdCBhbiBcIm93blwiIG9wdGlvbiwgb24gdGhlIGBwYXJlbnRgIG9iamVjdCBvciBmcm9tIHRoZSBvcHRpb25zIHNjaGVtYSBkZWZhdWx0IChpZiBhbnkpXG4gICAgICogQHBhcmFtIHN0YXRlXG4gICAgICogQHBhcmFtIG9wdGlvbnNcbiAgICAgKi9cbiAgICBtaXhJblN0YW5kYXJkT3B0aW9uczogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzO1xuXG4gICAgICAgIF8oRmlsdGVyTm9kZS5vcHRpb25zU2NoZW1hKS5lYWNoKGZ1bmN0aW9uKG9wdGlvblNjaGVtYSwga2V5KSB7XG4gICAgICAgICAgICBpZiAoIW9wdGlvblNjaGVtYS5pZ25vcmUgJiYgKHRoaXMgIT09IHRoaXMucm9vdCB8fCBvcHRpb25TY2hlbWEucm9vdEJvdW5kKSkge1xuICAgICAgICAgICAgICAgIHZhciBvcHRpb247XG5cbiAgICAgICAgICAgICAgICBub2RlLmRvbnRQZXJzaXN0W2tleV0gPSAvLyB0cnV0aHkgaWYgZnJvbSBgb3B0aW9uc2Agb3IgYGRlZmF1bHRgXG4gICAgICAgICAgICAgICAgICAgIChvcHRpb24gPSBvcHRpb25zICYmIG9wdGlvbnNba2V5XSkgIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICAgICAgICAob3B0aW9uID0gc3RhdGUgJiYgc3RhdGVba2V5XSkgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgICAgICAgICAhKG9wdGlvblNjaGVtYS5vd24gfHwgbm9kZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIG9wdGlvbiAhPT0gbnVsbCkgJiZcbiAgICAgICAgICAgICAgICAgICAgIShvcHRpb24gPSBub2RlLnBhcmVudCAmJiBub2RlLnBhcmVudFtrZXldKSAmJlxuICAgICAgICAgICAgICAgICAgICAob3B0aW9uID0gb3B0aW9uU2NoZW1hLmRlZmF1bHQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgbm9kZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICBub2RlLmRvbnRQZXJzaXN0W2tleV0gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSAnc2NoZW1hJyAmJiAhb3B0aW9uLndhbGspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGF0dGFjaCB0aGUgYHdhbGtgIGFuZCBgZmluZGAgY29udmVuaWVuY2UgbWV0aG9kcyB0byB0aGUgYHNjaGVtYWAgYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbi53YWxrID0gcG9wTWVudS53YWxrLmJpbmQob3B0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbi5sb29rdXAgPSBwb3BNZW51Lmxvb2t1cC5iaW5kKG9wdGlvbiwgbm9kZS5yb290LmZpbmRPcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBub2RlW2tleV0gPSBvcHRpb247XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIG9wdGlvbnNcbiAgICAgKi9cbiAgICBtaXhJbk5vbnN0YW5kYXJkT3B0aW9uczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgbm9kZSA9IHRoaXM7XG5cbiAgICAgICAgLy8gY29weSBhbGwgcmVtYWluaW5nIG9wdGlvbnMgZGlyZWN0bHkgdG8gdGhlIG5ldyBpbnN0YW5jZSwgb3ZlcnJpZGluZyBwcm90b3R5cGUgbWVtYmVycyBvZiB0aGUgc2FtZSBuYW1lXG4gICAgICAgIF8ob3B0aW9ucykuZWFjaChmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICBpZiAoIUZpbHRlck5vZGUub3B0aW9uc1NjaGVtYVtrZXldKSB7XG4gICAgICAgICAgICAgICAgbm9kZVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKiogUmVtb3ZlIGJvdGg6XG4gICAgICogKiBgdGhpc2AgZmlsdGVyIG5vZGUgZnJvbSBpdCdzIGBwYXJlbnRgJ3MgYGNoaWxkcmVuYCBjb2xsZWN0aW9uOyBhbmRcbiAgICAgKiAqIGB0aGlzYCBmaWx0ZXIgbm9kZSdzIGBlbGAncyBjb250YWluZXIgKGFsd2F5cyBhIGA8bGk+YCBlbGVtZW50KSBmcm9tIGl0cyBwYXJlbnQgZWxlbWVudC5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICByZW1vdmU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXZlcnQsXG4gICAgICAgICAgICBwYXJlbnQgPSB0aGlzLnBhcmVudDtcblxuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlci5jYWxsKHBhcmVudCwge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZGVsZXRlJyxcbiAgICAgICAgICAgICAgICAgICAgcHJldmVudERlZmF1bHQ6IGZ1bmN0aW9uKCkgeyBhdmVydCA9IHRydWU7IH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghYXZlcnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5rZWVwIHx8IC8vIG5ldmVyIFwicHJ1bmVcIiAocmVtb3ZlIGlmIGVtcHR5KSB0aGlzIHBhcnRpY3VsYXIgc3ViZXhwcmVzc2lvblxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID4gMSAvLyB0aGlzIG5vZGUgaGFzIHNpYmxpbmdzIHNvIHdpbGwgbm90IGJlIGVtcHR5IGFmdGVyIHRoaXMgcmVtb3ZlXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByb2NlZWQgd2l0aCByZW1vdmVcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbC5wYXJlbnROb2RlLnJlbW92ZSgpOyAvLyB0aGUgcGFyZW50IGlzIGFsd2F5cyB0aGUgY29udGFpbmluZyA8bGk+IHRhZ1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuY2hpbGRyZW4uc3BsaWNlKHBhcmVudC5jaGlsZHJlbi5pbmRleE9mKHRoaXMpLCAxKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyByZWN1cnNlIHRvIHBydW5lIGVudGlyZSBzdWJleHByZXNzaW9uIGJlY2F1c2UgaXQncyBwcnVuZS1hYmxlIGFuZCB3b3VsZCBlbmQgdXAgZW1wdHkgKGNoaWxkbGVzcylcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXb3JrLWFyb3VuZCBmb3IgYHRoaXMuZWwucXVlcnlTZWxlY3RvcignOnNjb3BlPicgKyBzZWxlY3RvcilgIGJlY2F1c2UgYDpzY29wZWAgbm90IHN1cHBvcnRlZCBpbiBJRTExLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RvclxuICAgICAqL1xuICAgIGZpcnN0Q2hpbGRPZlR5cGU6IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgICAgIHZhciBlbCA9IHRoaXMuZWwucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIGlmIChlbCAmJiBlbC5wYXJlbnRFbGVtZW50ICE9PSB0aGlzLmVsKSB7XG4gICAgICAgICAgICBlbCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH0sXG5cbiAgICBFcnJvcjogRmlsdGVyVHJlZUVycm9yLFxuXG4gICAgdGVtcGxhdGVzOiBuZXcgVGVtcGxhdGVzKClcbn0pO1xuXG4vKiogQHR5cGVkZWYgb3B0aW9uc1NjaGVtYU9iamVjdFxuICogQHN1bW1hcnkgU3RhbmRhcmQgb3B0aW9uIHNjaGVtYVxuICogQGRlc2MgU3RhbmRhcmQgb3B0aW9ucyBhcmUgYXV0b21hdGljYWxseSBhZGRlZCB0byBub2Rlcy4gRGF0YSBzb3VyY2VzIGZvciBzdGFuZGFyZCBvcHRpb25zIGluY2x1ZGUgYG9wdGlvbnNgLCBgc3RhdGVgLCBgcGFyZW50YCBhbmQgYGRlZmF1bHRgIChpbiB0aGF0IG9yZGVyKS4gRGVzY3JpYmVzIHN0YW5kYXJkIG9wdGlvbnMgdGhyb3VnaCB2YXJpb3VzIHByb3BlcnRpZXM6XG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtpZ25vcmVdIC0gRG8gbm90IGF1dG9tYXRpY2FsbHkgYWRkIHRvIG5vZGVzIChwcm9jZXNzZWQgZWxzZXdoZXJlKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW293bl0gLSBEbyBub3QgYXV0b21hdGljYWxseSBhZGQgZnJvbSBgcGFyZW50YCBvciBgZGVmYXVsdGAuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtyb290Qm91bmRdIC0gQXV0b21hdGljYWxseSBhZGQgdG8gcm9vdCBub2RlIG9ubHkuXG4gKiBAcHJvcGVydHkgeyp9IFtkZWZhdWx0XSAtIFRoaXMgaXMgdGhlIGRlZmF1bHQgZGF0YSBzb3VyY2Ugd2hlbiBhbGwgb3RoZXIgc3RyYXRlZ2llcyBmYWlsLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgRGVmaW5lcyB0aGUgc3RhbmRhcmQgb3B0aW9ucyBhdmFpbGFibGUgdG8gYSBub2RlLlxuICogQGRlc2MgVGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzIGJlYXIgdGhlIHNhbWUgbmFtZXMgYXMgdGhlIG5vZGUgb3B0aW9ucyB0aGV5IGRlZmluZS5cbiAqIEB0eXBlIHtvYmplY3R9XG4gKiBAbWVtYmVyT2YgRmlsdGVyTm9kZVxuICovXG5GaWx0ZXJOb2RlLm9wdGlvbnNTY2hlbWEgPSB7XG5cbiAgICBzdGF0ZTogeyBpZ25vcmU6IHRydWUgfSxcblxuICAgIGNzc1N0eWxlc2hlZXRSZWZlcmVuY2VFbGVtZW50OiB7IGlnbm9yZTogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IERlZmF1bHQgY29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIGRyb3AtZG93bnMgb2YgZGlyZWN0IGRlc2NlbmRhbnQgbGVhZiBub2RlcyBvbmx5LlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBvd25TY2hlbWE6IHsgb3duOiB0cnVlIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgQ29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIGRyb3AtZG93bnMgb2YgYWxsIGRlc2NlbmRhbnQgbm9kZXMuIFBlcnRhaW5zIHRvIGxlYWYgbm9kZXMgb25seS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAgICAgKi9cbiAgICBzY2hlbWE6IHt9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IEZpbHRlciBlZGl0b3IgZm9yIHVzZXIgaW50ZXJmYWNlLlxuICAgICAqIEBkZXNjIE5hbWUgb2YgZmlsdGVyIGVkaXRvciB1c2VkIGJ5IHRoaXMgYW5kIGFsbCBkZXNjZW5kYW50IG5vZGVzLiBQZXJ0YWlucyB0byBsZWFmIG5vZGVzIG9ubHkuXG4gICAgICogQGRlZmF1bHQgJ0RlZmF1bHQnXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBlZGl0b3I6IHt9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IEV2ZW50IGhhbmRsZXIgZm9yIFVJIGV2ZW50cy5cbiAgICAgKiBAZGVzYyBTZWUgKkV2ZW50cyogaW4gdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9pbmRleC5odG1sfHJlYWRtZX0gZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGV2ZW50SGFuZGxlcjoge30sXG5cbiAgICAvKiogQHN1bW1hcnkgRmllbGRzIGRhdGEgdHlwZS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHR5cGU6IHsgb3duOiB0cnVlIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgVW5kZWxldGVhYmxlIG5vZGUuXG4gICAgICogQGRlc2MgVHJ1dGh5IG1lYW5zIGRvbid0IHJlbmRlciBhIGRlbGV0ZSBidXR0b24gbmV4dCB0byB0aGUgZmlsdGVyIGVkaXRvciBmb3IgdGhpcyBub2RlLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGtlZXA6IHsgb3duOiB0cnVlIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgT3ZlcnJpZGUgb3BlcmF0b3IgbGlzdCBhdCBhbnkgbm9kZS5cbiAgICAgKiBAZGVzYyBUaGUgZGVmYXVsdCBpcyBhcHBsaWVkIHRvIHRoZSByb290IG5vZGUgYW5kIGFueSBvdGhlciBub2RlIHdpdGhvdXQgYW4gb3BlcmF0b3IgbWVudS5cbiAgICAgKiBAZGVmYXVsdCB7QGxpbmsgQ29uZGl0aW9uYWxzLmRlZmF1bHRPcE1lbnV9LlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHttZW51SXRlbVtdfVxuICAgICAqL1xuICAgIG9wTWVudTogeyBkZWZhdWx0OiBDb25kaXRpb25hbHMuZGVmYXVsdE9wTWVudSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IFRydXRoeSBjb25zaWRlcnMgb3AgdmFsaWQgb25seSBpZiBpbiBtZW51LlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIG9wTXVzdEJlSW5NZW51OiB7fSxcblxuICAgIC8qKiBAc3VtbWFyeSBEaWN0aW9uYXJ5IG9mIG9wZXJhdG9yIG1lbnVzIGZvciBzcGVjaWZpYyBkYXRhIHR5cGVzLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQGRlc2MgQSBoYXNoIG9mIHR5cGUgbmFtZXMuIEVhY2ggbWVtYmVyIHRodXMgZGVmaW5lZCBjb250YWlucyBhIHNwZWNpZmljIG9wZXJhdG9yIG1lbnUgZm9yIGFsbCBkZXNjZW5kYW50IGxlYWYgbm9kZXMgdGhhdDpcbiAgICAgKiAxLiBkbyBub3QgaGF2ZSB0aGVpciBvd24gb3BlcmF0b3IgbWVudSAoYG9wTWVudWAgcHJvcGVydHkpIG9mIHRoZWlyIG93bjsgYW5kXG4gICAgICogMi4gd2hvc2UgY29sdW1ucyByZXNvbHZlIHRvIHRoYXQgdHlwZS5cbiAgICAgKlxuICAgICAqIFRoZSB0eXBlIGlzIGRldGVybWluZWQgYnkgKGluIHByaW9yaXR5IG9yZGVyKTpcbiAgICAgKiAxLiB0aGUgYHR5cGVgIHByb3BlcnR5IG9mIHRoZSB7QGxpbmsgRmlsdGVyTGVhZn07IG9yXG4gICAgICogMi4gdGhlIGB0eXBlYCBwcm9wZXJ0eSBvZiB0aGUgZWxlbWVudCBpbiB0aGUgbmVhcmVzdCBub2RlIChpbmNsdWRpbmcgdGhlIGxlYWYgbm9kZSBpdHNlbGYpIHRoYXQgaGFzIGEgZGVmaW5lZCBgb3duU2NoZW1hYCBvciBgc2NoZW1hYCBhcnJheSBwcm9wZXJ0eSB3aXRoIGFuIGVsZW1lbnQgaGF2aW5nIGEgbWF0Y2hpbmcgY29sdW1uIG5hbWUuXG4gICAgICovXG4gICAgdHlwZU9wTWFwOiB7IHJvb3RCb3VuZDogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IFRydXRoeSB3aWxsIHNvcnQgdGhlIGNvbHVtbiBtZW51cy5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzb3J0Q29sdW1uTWVudToge31cbn07XG5cbkZpbHRlck5vZGUuc2V0V2FybmluZ0NsYXNzID0gZnVuY3Rpb24oZWwsIHZhbHVlKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB7XG4gICAgICAgIHZhbHVlID0gZWwudmFsdWU7XG4gICAgfVxuICAgIGVsLmNsYXNzTGlzdFt2YWx1ZSA/ICdyZW1vdmUnIDogJ2FkZCddKCdmaWx0ZXItdHJlZS13YXJuaW5nJyk7XG4gICAgcmV0dXJuIHZhbHVlO1xufTtcblxuRmlsdGVyTm9kZS5jbGlja0luID0gZnVuY3Rpb24oZWwpIHtcbiAgICBpZiAoZWwpIHtcbiAgICAgICAgaWYgKGVsLnRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBlbC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdtb3VzZWRvd24nKSk7IH0sIDApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWwuZm9jdXMoKTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyTm9kZTtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4vLyBUaGlzIGlzIHRoZSBtYWluIGZpbGUsIHVzYWJsZSBhcyBpcywgc3VjaCBhcyBieSAvdGVzdC9pbmRleC5qcy5cblxuLy8gRm9yIG5wbTogcmVxdWlyZSB0aGlzIGZpbGVcbi8vIEZvciBDRE46IGd1bHBmaWxlLmpzIGJyb3dzZXJpZmllcyB0aGlzIGZpbGUgd2l0aCBzb3VyY2VtYXAgdG8gL2J1aWxkL2ZpbHRlci10cmVlLmpzIGFuZCB1Z2xpZmllZCB3aXRob3V0IHNvdXJjZW1hcCB0byAvYnVpbGQvZmlsdGVyLXRyZWUubWluLmpzLiBUaGUgQ0ROIGlzIGh0dHBzOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG52YXIgdW5zdHJ1bmdpZnkgPSByZXF1aXJlKCd1bnN0cnVuZ2lmeScpO1xuXG52YXIgXyA9IHJlcXVpcmUoJ29iamVjdC1pdGVyYXRvcnMnKTtcbnZhciBGaWx0ZXJOb2RlID0gcmVxdWlyZSgnLi9GaWx0ZXJOb2RlJyk7XG52YXIgRmlsdGVyTGVhZiA9IHJlcXVpcmUoJy4vRmlsdGVyTGVhZicpO1xudmFyIG9wZXJhdG9ycyA9IHJlcXVpcmUoJy4vdHJlZS1vcGVyYXRvcnMnKTtcblxuXG52YXIgb3JkaW5hbCA9IDA7XG5cbi8qKiBAY29uc3RydWN0b3JcbiAqIEBzdW1tYXJ5IEFuIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgdGhlIHJvb3Qgbm9kZSBvciBhIGJyYW5jaCBub2RlIGluIGEgZmlsdGVyIHRyZWUuXG4gKiBAZGVzYyBBIG5vZGUgcmVwcmVzZW50aW5nIGEgc3ViZXhwcmVzc2lvbiBpbiB0aGUgZmlsdGVyIGV4cHJlc3Npb24uIE1heSBiZSB0aG91Z2h0IG9mIGFzIGEgcGFyZW50aGVzaXplZCBzdWJleHByZXNzaW9uIGluIGFsZ2VicmFpYyBleHByZXNzaW9uIHN5bnRheC4gQXMgZGlzY3Vzc2VkIHVuZGVyIHtAbGluayBGaWx0ZXJOb2RlfSwgYSBgRmlsdGVyVHJlZWAgaW5zdGFuY2UncyBjaGlsZCBub2RlcyBtYXkgYmUgZWl0aGVyOlxuICogKiBPdGhlciAobmVzdGVkKSBgRmlsdGVyVHJlZWAgKG9yIHN1YmNsYXNzIHRoZXJlb2YpIG5vZGVzIHJlcHJlc2VudGluZyBzdWJleHByZXNzaW9ucy5cbiAqICoge0BsaW5rIEZpbHRlckxlYWZ9IChvciBzdWJjbGFzcyB0aGVyZW9mKSB0ZXJtaW5hbCBub2RlcyByZXByZXNlbnRpbmcgY29uZGl0aW9uYWwgZXhwcmVzc2lvbnMuXG4gKlxuICogVGhlIGBGaWx0ZXJUcmVlYCBvYmplY3QgYWxzbyBoYXMgbWV0aG9kcywgc29tZSBvZiB3aGljaCBvcGVyYXRlIG9uIGEgc3BlY2lmaWMgc3VidHJlZSBpbnN0YW5jZSwgYW5kIHNvbWUgb2Ygd2hpY2ggcmVjdXJzZSB0aHJvdWdoIGFsbCB0aGUgc3VidHJlZSdzIGNoaWxkIG5vZGVzIGFuZCBhbGwgdGhlaXIgZGVzY2VuZGFudHMsIF9ldGMuX1xuICpcbiAqIFRoZSByZWN1cnNpdmUgbWV0aG9kcyBhcmUgaW50ZXJlc3RpbmcuIFRoZXkgYWxsIHdvcmsgc2ltaWxhcmx5LCBsb29waW5nIHRocm91Z2ggdGhlIGxpc3Qgb2YgY2hpbGQgbm9kZXMsIHJlY3Vyc2luZyB3aGVuIHRoZSBjaGlsZCBub2RlIGlzIGEgbmVzdGVkIHN1YnRyZWUgKHdoaWNoIHdpbGwgcmVjdXJzZSBmdXJ0aGVyIHdoZW4gaXQgaGFzIGl0cyBvd24gbmVzdGVkIHN1YnRyZWVzKTsgYW5kIGNhbGxpbmcgdGhlIHBvbHltb3JwaGljIG1ldGhvZCB3aGVuIHRoZSBjaGlsZCBub2RlIGlzIGEgYEZpbHRlckxlYWZgIG9iamVjdCwgd2hpY2ggaXMgYSB0ZXJtaW5hbCBub2RlLiBTdWNoIHBvbHltb3JwaGljIG1ldGhvZHMgaW5jbHVkZSBgc2V0U3RhdGUoKWAsIGBnZXRTdGF0ZSgpYCwgYGludmFsaWQoKWAsIGFuZCBgdGVzdCgpYC5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgY2FsbGluZyBgdGVzdChkYXRhUm93KWAgb24gdGhlIHJvb3QgdHJlZSByZWN1cnNlcyB0aHJvdWdoIGFueSBzdWJ0cmVlcyBldmVudHVhbGx5IGNhbGxpbmcgYHRlc3QoZGF0YVJvdylgIG9uIGVhY2ggb2YgaXRzIGxlYWYgbm9kZXMgYW5kIGNvbmNhdGVuYXRpbmcgdGhlIHJlc3VsdHMgdG9nZXRoZXIgdXNpbmcgdGhlIHN1YnRyZWUncyBgb3BlcmF0b3JgLiBUaGUgc3VidHJlZSdzIGB0ZXN0KGRhdGFSb3cpYCBjYWxsIHRoZW4gcmV0dXJucyB0aGUgcmVzdWx0IHRvIGl0J3MgcGFyZW50J3MgYHRlc3QoKWAgY2FsbCwgX2V0Yy4sXyBldmVudHVhbGx5IGJ1YmJsaW5nIHVwIHRvIHRoZSByb290IG5vZGUncyBgdGVzdChkYXRhUm93KWAgY2FsbCwgd2hpY2ggcmV0dXJucyB0aGUgZmluYWwgcmVzdWx0IHRvIHRoZSBvcmlnaW5hbCBjYWxsZXIuIFRoaXMgcmVzdWx0IGRldGVybWluZXMgaWYgdGhlIGdpdmVuIGRhdGEgcm93IHBhc3NlZCB0aHJvdWdoIHRoZSBlbnRpcmUgZmlsdGVyIGV4cHJlc3Npb24gc3VjY2Vzc2Z1bGx5IChgdHJ1ZWApIGFuZCBzaG91bGQgYmUgZGlzcGxheWVkLCBvciB3YXMgYmxvY2tlZCBzb21ld2hlcmUgKGBmYWxzZWApIGFuZCBzaG91bGQgbm90IGJlIGRpc3BsYXllZC5cbiAqXG4gKiBOb3RlIHRoYXQgaW4gcHJhY3RpY2U6XG4gKiAxLiBgY2hpbGRyZW5gIG1heSBiZSBlbXB0eS4gVGhpcyByZXByZXNlbnRzIGEgYW4gZW1wdHkgc3ViZXhwcmVzc2lvbi4gTm9ybWFsbHkgcG9pbnRsZXNzLCBlbXB0eSBzdWJleHByZXNzaW9ucyBjb3VsZCBiZSBwcnVuZWQuIEZpbHRlci10cmVlIGFsbG93cyB0aGVtIGhvd2V2ZXIgYXMgaGFybWxlc3MgcGxhY2Vob2xkZXJzLlxuICogMS4gYG9wZXJhdG9yYCBtYXkgYmUgb21pdHRlZCBpbiB3aGljaCBjYXNlIGl0IGRlZmF1bHRzIHRvIEFORC5cbiAqIDEuIEEgYGZhbHNlYCByZXN1bHQgZnJvbSBhIGNoaWxkIG5vZGUgd2lsbCBzaG9ydC1zdG9wIGFuIEFORCBvcGVyYXRpb247IGEgYHRydWVgIHJlc3VsdCB3aWxsIHNob3J0LXN0b3AgYW4gT1Igb3IgTk9SIG9wZXJhdGlvbi5cbiAqXG4gKiBBZGRpdGlvbmFsIG5vdGVzOlxuICogMS4gQSBgRmlsdGVyVHJlZWAgbWF5IGNvbnNpc3Qgb2YgYSBzaW5nbGUgbGVhZiwgaW4gd2hpY2ggY2FzZSB0aGUgY29uY2F0ZW5hdGlvbiBgb3BlcmF0b3JgIGlzIG5vdCBuZWVkZWQgYW5kIG1heSBiZSBsZWZ0IHVuZGVmaW5lZC4gSG93ZXZlciwgaWYgYSBzZWNvbmQgY2hpbGQgaXMgYWRkZWQgYW5kIHRoZSBvcGVyYXRvciBpcyBzdGlsbCB1bmRlZmluZWQsIGl0IHdpbGwgYmUgc2V0IHRvIHRoZSBkZWZhdWx0IChgJ29wLWFuZCdgKS5cbiAqIDIuIFRoZSBvcmRlciBvZiB0aGUgY2hpbGRyZW4gaXMgdW5kZWZpbmVkIGFzIGFsbCBvcGVyYXRvcnMgYXJlIGNvbW11dGF0aXZlLiBGb3IgdGhlICdgb3Atb3JgJyBvcGVyYXRvciwgZXZhbHVhdGlvbiBjZWFzZXMgb24gdGhlIGZpcnN0IHBvc2l0aXZlIHJlc3VsdCBhbmQgZm9yIGVmZmljaWVuY3ksIGFsbCBzaW1wbGUgY29uZGl0aW9uYWwgZXhwcmVzc2lvbnMgd2lsbCBiZSBldmFsdWF0ZWQgYmVmb3JlIGFueSBjb21wbGV4IHN1YmV4cHJlc3Npb25zLlxuICogMy4gQSBuZXN0ZWQgYEZpbHRlclRyZWVgIGlzIGRpc3Rpbmd1aXNoZWQgKGR1Y2stdHlwZWQpIGZyb20gYSBsZWFmIG5vZGUgYnkgdGhlIHByZXNlbmNlIG9mIGEgYGNoaWxkcmVuYCBtZW1iZXIuXG4gKiA0LiBOZXN0aW5nIGEgYEZpbHRlclRyZWVgIGNvbnRhaW5pbmcgYSBzaW5nbGUgY2hpbGQgaXMgdmFsaWQgKGFsYmVpdCBwb2ludGxlc3MpLlxuICpcbiAqICoqU2VlIGFsc28gdGhlIHByb3BlcnRpZXMgb2YgdGhlIHN1cGVyY2xhc3M6Kioge0BsaW5rIEZpbHRlck5vZGV9XG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtvcGVyYXRvcj0nb3AtYW5kJ10gLSBUaGUgb3BlcmF0b3IgdGhhdCBjb25jYXRlbnRhdGVzIHRoZSB0ZXN0IHJlc3VsdHMgZnJvbSBhbGwgdGhlIG5vZGUncyBgY2hpbGRyZW5gIChjaGlsZCBub2RlcykuIE11c3QgYmUgb25lIG9mOlxuICogKiBgJ29wLWFuZCdgXG4gKiAqIGAnb3Atb3InYFxuICogKiBgJ29wLW5vcidgXG4gKlxuICogTm90ZSB0aGF0IHRoZXJlIGlzIG9ubHkgb25lIGBvcGVyYXRvcmAgcGVyIHN1YmV4cHJlc3Npb24uIElmIHlvdSBuZWVkIHRvIG1peCBvcGVyYXRvcnMsIGNyZWF0ZSBhIHN1Ym9yZGluYXRlIHN1YmV4cHJlc3Npb24gYXMgb25lIG9mIHRoZSBjaGlsZCBub2Rlcy5cbiAqXG4gKiBAcHJvcGVydHkge0ZpbHRlck5vZGVbXX0gY2hpbGRyZW4gLSBBIGxpc3Qgb2YgZGVzY2VuZGFudHMgb2YgdGhpcyBub2RlLiBBcyBub3RlZCwgdGhlc2UgbWF5IGJlIG90aGVyIGBGaWx0ZXJUcmVlYCAob3Igc3ViY2xhc3MgdGhlcmVvZikgbm9kZXM7IG9yIG1heSBiZSB0ZXJtaW5hbCBgRmlsdGVyTGVhZmAgKG9yIHN1YmNsYXNzIHRoZXJlb2YpIG5vZGVzLiBNYXkgYmUgYW55IGxlbmd0aCBpbmNsdWRpbmcgMCAobm9uZTsgZW1wdHkpLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2tlZXA9ZmFsc2VdIC0gRG8gbm90IGF1dG9tYXRpY2FsbHkgcHJ1bmUgd2hlbiBsYXN0IGNoaWxkIHJlbW92ZWQuXG4gKlxuICogQHByb3BlcnR5IHtmaWVsZEl0ZW1bXX0gW293blNjaGVtYV0gLSBDb2x1bW4gbWVudSB0byBiZSB1c2VkIG9ubHkgYnkgbGVhZiBub2RlcyB0aGF0IGFyZSBjaGlsZHJlbiAoZGlyZWN0IGRlc2NlbmRhbnRzKSBvZiB0aGlzIG5vZGUuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFt0eXBlPSdzdWJ0cmVlJ10gLSBUeXBlIG9mIG5vZGUsIGZvciByZW5kZXJpbmcgcHVycG9zZXM7IG5hbWVzIHRoZSByZW5kZXJpbmcgdGVtcGxhdGUgdG8gdXNlIHRvIGdlbmVyYXRlIHRoZSBub2RlJ3MgVUkgcmVwcmVzZW50YXRpb24uXG4gKi9cbnZhciBGaWx0ZXJUcmVlID0gRmlsdGVyTm9kZS5leHRlbmQoJ0ZpbHRlclRyZWUnLCB7XG5cbiAgICAvKipcbiAgICAgKiBIYXNoIG9mIGNvbnN0cnVjdG9ycyBmb3Igb2JqZWN0cyB0aGF0IGV4dGVuZCBmcm9tIHtAbGluayBGaWx0ZXJMZWFmfSwgd2hpY2ggaXMgdGhlIGBEZWZhdWx0YCBtZW1iZXIgaGVyZS5cbiAgICAgKlxuICAgICAqIEFkZCBhZGRpdGlvbmFsIGVkaXRvcnMgdG8gdGhpcyBvYmplY3QgKGluIHRoZSBwcm90b3R5cGUpIHByaW9yIHRvIGluc3RhbnRpYXRpbmcgYSBsZWFmIG5vZGUgdGhhdCByZWZlcnMgdG8gaXQuIFRoaXMgb2JqZWN0IGV4aXN0cyBpbiB0aGUgcHJvdG90eXBlIGFuZCBhZGRpdGlvbnMgdG8gaXQgd2lsbCBhZmZlY3QgYWxsIG5vZGVzIHRoYXQgZG9uJ3QgaGF2ZSB0aGVpciBhbiBcIm93blwiIGhhc2guXG4gICAgICpcbiAgICAgKiBJZiB5b3UgY3JlYXRlIGFuIFwib3duXCIgaGFzaCBpbiB5b3VyIGluc3RhbmNlIGJlIHN1cmUgdG8gaW5jbHVkZSB0aGUgZGVmYXVsdCBlZGl0b3IsIGZvciBleGFtcGxlOiBgeyBEZWZhdWx0OiBGaWx0ZXJUcmVlLnByb3RvdHlwZS5lZGl0b3JzLkRlZmF1bHQsIC4uLiB9YC4gKE9uZSB3YXkgb2Ygb3ZlcnJpZGluZyB3b3VsZCBiZSB0byBpbmNsdWRlIHN1Y2ggYW4gb2JqZWN0IGluIGFuIGBlZGl0b3JzYCBtZW1iZXIgb2YgdGhlIG9wdGlvbnMgb2JqZWN0IHBhc3NlZCB0byB0aGUgY29uc3RydWN0b3Igb24gaW5zdGFudGlhdGlvbi4gVGhpcyB3b3JrcyBiZWNhdXNlIGFsbCBtaXNjZWxsYW5lb3VzIG1lbWJlcnMgYXJlIHNpbXBseSBjb3BpZWQgdG8gdGhlIG5ldyBpbnN0YW5jZS4gTm90IHRvIGJlIGNvbmZ1c2VkIHdpdGggdGhlIHN0YW5kYXJkIG9wdGlvbiBgZWRpdG9yYCB3aGljaCBpcyBhIHN0cmluZyBjb250YWluaW5nIGEga2V5IGZyb20gdGhpcyBoYXNoIGFuZCB0ZWxscyB0aGUgbGVhZiBub2RlIHdoYXQgdHlwZSB0byB1c2UuKVxuICAgICAqL1xuICAgIGVkaXRvcnM6IHtcbiAgICAgICAgRGVmYXVsdDogRmlsdGVyTGVhZlxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBbiBleHRlbnNpb24gaXMgYSBoYXNoIG9mIHByb3RvdHlwZSBvdmVycmlkZXMgKG1ldGhvZHMsIHByb3BlcnRpZXMpIHVzZWQgdG8gZXh0ZW5kIHRoZSBkZWZhdWx0IGVkaXRvci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2tleT0nRGVmYXVsdCddIC0gTm1lIG9mIHRoZSBuZXcgZXh0ZW5zaW9uIGdpdmVuIGluIGBleHRgIG9yIG5hbWUgb2YgYW4gZXhpc3RpbmcgZXh0ZW5zaW9uIGluIGBGaWx0ZXJUcmVlLmV4dGVuc2lvbnNgLiBBcyBhIGNvbnN0cnVjdG9yLCBzaG91bGQgaGF2ZSBhbiBpbml0aWFsIGNhcGl0YWwuIElmIG9taXR0ZWQsIHJlcGxhY2VzIHRoZSBkZWZhdWx0IGVkaXRvciAoRmlsdGVyTGVhZikuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtleHRdIEFuIGV4dGVuc2lvbiBoYXNoXG4gICAgICogQHBhcmFtIHtGaWxlckxlYWZ9IFtCYXNlRWRpdG9yPXRoaXMuZWRpdG9ycy5EZWZhdWx0XSAtIENvbnN0cnVjdG9yIHRvIGV4dGVuZCBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtGaWxsdGVyTGVhZn0gQSBuZXcgY2xhc3MgZXh0ZW5kZWQgZnJvbSBgQmFzZUVkaXRvcmAgLS0gd2hpY2ggaXMgaW5pdGlhbGx5IGBGaWx0ZXJMZWFmYCBidXQgbWF5IGl0c2VsZiBoYXZlIGJlZW4gZXh0ZW5kZWQgYnkgYSBjYWxsIHRvIGAuYWRkRWRpdG9yKCdEZWZhdWx0JywgZXh0ZW5zaW9uKWAuXG4gICAgICovXG4gICAgYWRkRWRpdG9yOiBmdW5jdGlvbihrZXksIGV4dCwgQmFzZUVkaXRvcikge1xuICAgICAgICBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIC8vIGBrZXlgIChzdHJpbmcpIHdhcyBvbWl0dGVkXG4gICAgICAgICAgICBCYXNlRWRpdG9yID0gZXh0O1xuICAgICAgICAgICAgZXh0ID0ga2V5O1xuICAgICAgICAgICAga2V5ID0gJ0RlZmF1bHQnO1xuICAgICAgICB9XG4gICAgICAgIEJhc2VFZGl0b3IgPSBCYXNlRWRpdG9yIHx8IHRoaXMuZWRpdG9ycy5EZWZhdWx0O1xuICAgICAgICBleHQgPSBleHQgfHwgRmlsdGVyVHJlZS5leHRlbnNpb25zW2tleV07XG4gICAgICAgIHJldHVybiAodGhpcy5lZGl0b3JzW2tleV0gPSBCYXNlRWRpdG9yLmV4dGVuZChrZXksIGV4dCkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVGhlIG5hbWUgb2YgdGhlIGV4aXN0aW5nIGVkaXRvciB0byByZW1vdmUuXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgcmVtb3ZlRWRpdG9yOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gJ0RlZmF1bHQnKSB7XG4gICAgICAgICAgICB0aHJvdyAnQ2Fubm90IHJlbW92ZSBkZWZhdWx0IGVkaXRvci4nO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSB0aGlzLmVkaXRvcnNba2V5XTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBjcmVhdGVWaWV3OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5lbCA9IHRoaXMudGVtcGxhdGVzLmdldChcbiAgICAgICAgICAgIHRoaXMudHlwZSB8fCAnc3VidHJlZScsXG4gICAgICAgICAgICArK29yZGluYWwsXG4gICAgICAgICAgICB0aGlzLnNjaGVtYVswXSAmJiBwb3BNZW51LmZvcm1hdEl0ZW0odGhpcy5zY2hlbWFbMF0pXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gQWRkIHRoZSBleHByZXNzaW9uIGVkaXRvcnMgdG8gdGhlIFwiYWRkIG5ld1wiIGRyb3AtZG93blxuICAgICAgICB2YXIgYWRkTmV3Q3RybCA9IHRoaXMuZmlyc3RDaGlsZE9mVHlwZSgnc2VsZWN0Jyk7XG4gICAgICAgIGlmIChhZGROZXdDdHJsKSB7XG4gICAgICAgICAgICB2YXIgc3VibWVudSwgb3B0Z3JvdXAsXG4gICAgICAgICAgICAgICAgZWRpdG9ycyA9IHRoaXMuZWRpdG9ycztcblxuICAgICAgICAgICAgaWYgKGFkZE5ld0N0cmwubGVuZ3RoID09PSAxICYmIHRoaXMuZWRpdG9ycy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGVkaXRvciBpcyB0aGUgb25seSBvcHRpb24gYmVzaWRlcyB0aGUgbnVsbCBwcm9tcHQgb3B0aW9uXG4gICAgICAgICAgICAgICAgLy8gc28gbWFrZSBpdCB0aCBlb25seSBpdGVtIGkgdGhlIGRyb3AtZG93blxuICAgICAgICAgICAgICAgIHN1Ym1lbnUgPSBhZGROZXdDdHJsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0aGVyZSBhcmUgYWxyZWFkeSBvcHRpb25zIGFuZC9vciBtdWx0aXBsZSBlZGl0b3JzXG4gICAgICAgICAgICAgICAgc3VibWVudSA9IG9wdGdyb3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0Z3JvdXAnKTtcbiAgICAgICAgICAgICAgICBvcHRncm91cC5sYWJlbCA9ICdDb25kaXRpb25hbCBFeHByZXNzaW9ucyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhlZGl0b3JzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gZWRpdG9yc1trZXldLnByb3RvdHlwZS5uYW1lIHx8IGtleTtcbiAgICAgICAgICAgICAgICBzdWJtZW51LmFwcGVuZENoaWxkKG5ldyBPcHRpb24obmFtZSwga2V5KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChvcHRncm91cCkge1xuICAgICAgICAgICAgICAgIGFkZE5ld0N0cmwuYWRkKG9wdGdyb3VwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgb25jaGFuZ2UuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25UcmVlT3BDbGljay5iaW5kKHRoaXMpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBsb2FkU3RhdGU6IGZ1bmN0aW9uKHN0YXRlKSB7XG4gICAgICAgIHRoaXMub3BlcmF0b3IgPSAnb3AtYW5kJztcbiAgICAgICAgdGhpcy5jaGlsZHJlbiA9IFtdO1xuXG4gICAgICAgIGlmICghc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSBgc3RhdGUuY2hpbGRyZW5gIChyZXF1aXJlZClcbiAgICAgICAgICAgIGlmICghKHN0YXRlLmNoaWxkcmVuIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuRXJyb3IoJ0V4cGVjdGVkIGBjaGlsZHJlbmAgcHJvcGVydHkgdG8gYmUgYW4gYXJyYXkuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZhbGlkYXRlIGBzdGF0ZS5vcGVyYXRvcmAgKGlmIGdpdmVuKVxuICAgICAgICAgICAgaWYgKHN0YXRlLm9wZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvcGVyYXRvcnNbc3RhdGUub3BlcmF0b3JdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyB0aGlzLkVycm9yKCdFeHBlY3RlZCBgb3BlcmF0b3JgIHByb3BlcnR5IHRvIGJlIG9uZSBvZjogJyArIE9iamVjdC5rZXlzKG9wZXJhdG9ycykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMub3BlcmF0b3IgPSBzdGF0ZS5vcGVyYXRvcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3RhdGUuY2hpbGRyZW4uZm9yRWFjaCh0aGlzLmFkZC5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByYWRpb0J1dHRvbiA9IHRoaXMuZmlyc3RDaGlsZE9mVHlwZSgnbGFiZWwgPiBpbnB1dFt2YWx1ZT0nICsgdGhpcy5vcGVyYXRvciArICddJyksXG4gICAgICAgICAgICBhZGRGaWx0ZXJMaW5rID0gdGhpcy5lbC5xdWVyeVNlbGVjdG9yKCcuZmlsdGVyLXRyZWUtYWRkLWNvbmRpdGlvbmFsJyk7XG5cbiAgICAgICAgaWYgKHJhZGlvQnV0dG9uKSB7XG4gICAgICAgICAgICByYWRpb0J1dHRvbi5jaGVja2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIG9uVHJlZU9wQ2xpY2suY2FsbCh0aGlzLCB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiByYWRpb0J1dHRvblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3aGVuIG11bHRpcGxlIGZpbHRlciBlZGl0b3JzIGF2YWlsYWJsZSwgc2ltdWxhdGUgY2xpY2sgb24gdGhlIG5ldyBcImFkZCBjb25kaXRpb25hbFwiIGxpbmtcbiAgICAgICAgaWYgKGFkZEZpbHRlckxpbmsgJiYgIXRoaXMuY2hpbGRyZW4ubGVuZ3RoICYmIE9iamVjdC5rZXlzKHRoaXMuZWRpdG9ycykubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhpc1snZmlsdGVyLXRyZWUtYWRkLWNvbmRpdGlvbmFsJ10oe1xuICAgICAgICAgICAgICAgIHRhcmdldDogYWRkRmlsdGVyTGlua1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9jZWVkIHdpdGggcmVuZGVyXG4gICAgICAgIEZpbHRlck5vZGUucHJvdG90eXBlLnJlbmRlci5jYWxsKHRoaXMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBDcmVhdGUgYSBuZXcgbm9kZSBhcyBwZXIgYHN0YXRlYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucz17c3RhdGU6e319XSAtIE1heSBiZSBvbmUgb2Y6XG4gICAgICpcbiAgICAgKiAqIGFuIGBvcHRpb25zYCBvYmplY3QgY29udGFpbmluZyBhIGBzdGF0ZWAgcHJvcGVydHlcbiAgICAgKiAqIGEgYHN0YXRlYCBvYmplY3QgKGluIHdoaWNoIGNhc2UgdGhlcmUgaXMgbm8gYG9wdGlvbnNgIG9iamVjdClcbiAgICAgKlxuICAgICAqIEluIGFueSBjYXNlLCByZXN1bHRpbmcgYHN0YXRlYCBvYmplY3QgbWF5IGJlIGVpdGhlci4uLlxuICAgICAqICogQSBuZXcgc3VidHJlZSAoaGFzIGEgYGNoaWxkcmVuYCBwcm9wZXJ0eSk6XG4gICAgICogICBBZGQgYSBuZXcgYEZpbHRlclRyZWVgIG5vZGUuXG4gICAgICogKiBBIG5ldyBsZWFmIChubyBgY2hpbGRyZW5gIHByb3BlcnR5KTogYWRkIGEgbmV3IGBGaWx0ZXJMZWFmYCBub2RlOlxuICAgICAqICAgKiBJZiB0aGVyZSBpcyBhbiBgZWRpdG9yYCBwcm9wZXJ0eTpcbiAgICAgKiAgICAgQWRkIGxlYWYgdXNpbmcgYHRoaXMuZWRpdG9yc1tzdGF0ZS5lZGl0b3JdYC5cbiAgICAgKiAgICogT3RoZXJ3aXNlIChpbmNsdWRpbmcgdGhlIGNhc2Ugd2hlcmUgYHN0YXRlYCBpcyB1bmRlZmluZWQpOlxuICAgICAqICAgICBBZGQgbGVhZiB1c2luZyBgdGhpcy5lZGl0b3JzLkRlZmF1bHRgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mb2N1cz1mYWxzZV0gQ2FsbCBpbnZhbGlkKCkgYWZ0ZXIgaW5zZXJ0aW5nIHRvIGZvY3VzIG9uIGZpcnN0IGJsYW5rIGNvbnRyb2wgKGlmIGFueSkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyTm9kZX0gVGhlIG5ldyBub2RlLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgYWRkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBDb25zdHJ1Y3RvciwgbmV3Tm9kZTtcblxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMuc3RhdGUpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7IHN0YXRlOiBvcHRpb25zIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5zdGF0ZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgQ29uc3RydWN0b3IgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgQ29uc3RydWN0b3IgPSB0aGlzLmVkaXRvcnNbb3B0aW9ucy5zdGF0ZS5lZGl0b3IgfHwgJ0RlZmF1bHQnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMucGFyZW50ID0gdGhpcztcbiAgICAgICAgbmV3Tm9kZSA9IG5ldyBDb25zdHJ1Y3RvcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ld05vZGUpO1xuXG4gICAgICAgIGlmIChvcHRpb25zLmZvY3VzKSB7XG4gICAgICAgICAgICAvLyBmb2N1cyBvbiBibGFuayBjb250cm9sIGEgYmVhdCBhZnRlciBhZGRpbmcgaXRcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IG5ld05vZGUuaW52YWxpZChvcHRpb25zKTsgfSwgNzUwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXdOb2RlO1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGVkZWYge29iamVjdH0gRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0XG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSBbdGhyb3c9ZmFsc2VdIC0gVGhyb3cgKGRvIG5vdCBjYXRjaCkgYEZpbHRlclRyZWVFcnJvcmBzLlxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2FsZXJ0PWZhbHNlXSAtIEFubm91bmNlIGVycm9yIHZpYSB3aW5kb3cuYWxlcnQoKSBiZWZvcmUgcmV0dXJuaW5nLlxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW2ZvY3VzPWZhbHNlXSAtIFBsYWNlIHRoZSBmb2N1cyBvbiB0aGUgb2ZmZW5kaW5nIGNvbnRyb2wgYW5kIGdpdmUgaXQgZXJyb3IgY29sb3IuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH0gW29wdGlvbnNdXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxGaWx0ZXJUcmVlRXJyb3J9IGB1bmRlZmluZWRgIGlmIHZhbGlkOyBvciB0aGUgY2F1Z2h0IGBGaWx0ZXJUcmVlRXJyb3JgIGlmIGVycm9yLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIGludmFsaWQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgdmFyIHJlc3VsdCwgdGhyb3dXYXM7XG5cbiAgICAgICAgdGhyb3dXYXMgPSBvcHRpb25zLnRocm93O1xuICAgICAgICBvcHRpb25zLnRocm93ID0gdHJ1ZTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaW52YWxpZC5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGVycjtcblxuICAgICAgICAgICAgLy8gVGhyb3cgd2hlbiB1bmV4cGVjdGVkIChub3QgYSBmaWx0ZXIgdHJlZSBlcnJvcilcbiAgICAgICAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIHRoaXMuRXJyb3IpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgb3B0aW9ucy50aHJvdyA9IHRocm93V2FzO1xuXG4gICAgICAgIC8vIEFsdGVyIGFuZC9vciB0aHJvdyB3aGVuIHJlcXVlc3RlZFxuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5hbGVydCkge1xuICAgICAgICAgICAgICAgIHdpbmRvdy5hbGVydChyZXN1bHQubWVzc2FnZSB8fCByZXN1bHQpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWFsZXJ0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3B0aW9ucy50aHJvdykge1xuICAgICAgICAgICAgICAgIHRocm93IHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFSb3dcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICB0ZXN0OiBmdW5jdGlvbiB0ZXN0KGRhdGFSb3cpIHtcbiAgICAgICAgdmFyIG9wZXJhdG9yID0gb3BlcmF0b3JzW3RoaXMub3BlcmF0b3JdLFxuICAgICAgICAgICAgcmVzdWx0ID0gb3BlcmF0b3Iuc2VlZCxcbiAgICAgICAgICAgIG5vQ2hpbGRyZW5EZWZpbmVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLmNoaWxkcmVuLmZpbmQoZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgIG5vQ2hpbGRyZW5EZWZpbmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBvcGVyYXRvci5yZWR1Y2UocmVzdWx0LCBjaGlsZC50ZXN0KGRhdGFSb3cpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBvcGVyYXRvci5yZWR1Y2UocmVzdWx0LCB0ZXN0LmNhbGwoY2hpbGQsIGRhdGFSb3cpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCA9PT0gb3BlcmF0b3IuYWJvcnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIG5vQ2hpbGRyZW5EZWZpbmVkIHx8IChvcGVyYXRvci5uZWdhdGUgPyAhcmVzdWx0IDogcmVzdWx0KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge251bWJlcn0gTnVtYmVyIG9mIGZpbHRlcnMgKHRlcm1pbmFsIG5vZGVzKSBkZWZpbmVkIGluIHRoaXMgc3VidHJlZS5cbiAgICAgKi9cbiAgICBmaWx0ZXJDb3VudDogZnVuY3Rpb24gZmlsdGVyQ291bnQoKSB7XG4gICAgICAgIHZhciBuID0gMDtcblxuICAgICAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICAgIG4gKz0gY2hpbGQgaW5zdGFuY2VvZiBGaWx0ZXJMZWFmID8gMSA6IGZpbHRlckNvdW50LmNhbGwoY2hpbGQpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gbjtcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3RcbiAgICAgKlxuICAgICAqIEBzdW1tYXJ5IE9iamVjdCBjb250YWluaW5nIG9wdGlvbnMgZm9yIHByb2R1Y2luZyBhIHN0YXRlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBkZXNjIFN0YXRlIGlzIGNvbW1vbmx5IHVzZWQgZm9yIHR3byBwdXJwb3NlczpcbiAgICAgKiAxLiBUbyBwZXJzaXN0IHRoZSBmaWx0ZXIgc3RhdGUgc28gdGhhdCBpdCBjYW4gYmUgcmVsb2FkZWQgbGF0ZXIuXG4gICAgICogMi4gVG8gc2VuZCBhIHF1ZXJ5IHRvIGEgZGF0YWJhc2UgZW5naW5lLlxuICAgICAqXG4gICAgICogQHByb3BlcnR5IHtib29sZWFufSBbc3ludGF4PSdvYmplY3QnXSAtIEEgY2FzZS1zZW5zaXRpdmUgc3RyaW5nIGluZGljYXRpbmcgdGhlIGV4cGVjdGVkIHR5cGUgYW5kIGZvcm1hdCBvZiBhIHN0YXRlIG9iamVjdCB0byBiZSBnZW5lcmF0ZWQgZnJvbSBhIGZpbHRlciB0cmVlLiBPbmUgb2Y6XG4gICAgICogKiBgJ29iamVjdCdgIChkZWZhdWx0KSBBIHJhdyBzdGF0ZSBvYmplY3QgcHJvZHVjZWQgYnkgd2Fsa2luZyB0aGUgdHJlZSB1c2luZyBge0BsaW5rIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL3Vuc3RydW5naWZ5fHVuc3RydW5naWZ5KCl9YCwgcmVzcGVjdGluZyBgSlNPTi5zdHJpbmdpZnkoKWAncyBcIntAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9KU09OL3N0cmluZ2lmeSN0b0pTT04oKV9iZWhhdmlvcnx0b0pTT04oKSBiZWhhdmlvcn0sXCIgYW5kIHJldHVybmluZyBhIHBsYWluIG9iamVjdCBzdWl0YWJsZSBmb3IgcmVzdWJtaXR0aW5nIHRvIHtAbGluayBGaWx0ZXJOb2RlI3NldFN0YXRlfHNldFN0YXRlfS4gVGhpcyBpcyBhbiBcImVzc2VudGlhbFwiIHZlcnNpb24gb2YgdGhlIGFjdHVhbCBub2RlIG9iamVjdHMgaW4gdGhlIHRyZWUuXG4gICAgICogKiBgJ0pTT04nYCAtIEEgc3RyaW5naWZpZWQgc3RhdGUgb2JqZWN0IHByb2R1Y2VkIGJ5IHdhbGtpbmcgdGhlIHRyZWUgdXNpbmcgYHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9KU09OL3N0cmluZ2lmeSN0b0pTT04oKV9iZWhhdmlvcnxKU09OLnN0cmluZ2lmeSgpfWAsIHJldHVybmluZyBhIEpTT04gc3RyaW5nIGJ5IGNhbGxpbmcgYHRvSlNPTmAgYXQgZXZlcnkgbm9kZS4gVGhpcyBpcyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgc2FtZSBcImVzc2VudGlhbFwiIG9iamVjdCBhcyB0aGF0IHByb2R1Y2VkIGJ5IHRoZSBgJ29iamVjdCdgIG9wdGlvbiwgYnV0IFwic3RyaW5naWZpZWRcIiBhbmQgdGhlcmVmb3JlIHN1aXRhYmxlIGZvciB0ZXh0LWJhc2VkIHN0b3JhZ2UgbWVkaWEuXG4gICAgICogKiBgJ1NRTCdgIC0gVGhlIHN1YmV4cHJlc3Npb24gaW4gU1FMIGNvbmRpdGlvbmFsIHN5bnRheCBwcm9kdWNlZCBieSB3YWxraW5nIHRoZSB0cmVlIGFuZCByZXR1cm5pbmcgYSBTUUwgW3NlYXJjaCBjb25kaXRpb24gZXhwcmVzc2lvbl17QGxpbmsgaHR0cHM6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczE3MzU0NS5hc3B4fS4gU3VpdGFibGUgZm9yIHVzZSBpbiB0aGUgV0hFUkUgY2xhdXNlIG9mIGEgU1FMIGBTRUxFQ1RgIHN0YXRlbWVudCB1c2VkIHRvIHF1ZXJ5IGEgZGF0YWJhc2UgZm9yIGEgZmlsdGVyZWQgcmVzdWx0IHNldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gW3NwYWNlXSAtIFdoZW4gYG9wdGlvbnMuc3ludGF4ID09PSAnSlNPTidgLCBmb3J3YXJkZWQgdG8gYEpTT04uc3RyaW5naWZ5YCBhcyB0aGUgdGhpcmQgcGFyYW1ldGVyLCBgc3BhY2VgIChzZWUpLlxuICAgICAqXG4gICAgICogTk9URTogVGhlIFNRTCBzeW50YXggcmVzdWx0IGNhbm5vdCBhY2NvbW1vZGF0ZSBub2RlIG1ldGEtZGF0YS4gV2hpbGUgbWV0YS1kYXRhIHN1Y2ggYXMgYHR5cGVgIHR5cGljYWxseSBjb21lcyBmcm9tIHRoZSBjb2x1bW4gc2NoZW1hLCBtZXRhLWRhdGEgY2FuIGJlIGluc3RhbGxlZCBkaXJlY3RseSBvbiBhIG5vZGUuIFN1Y2ggbWV0YS1kYXRhIHdpbGwgbm90IGJlIHBhcnQgb2YgdGhlIHJlc3VsdGluZyBTUUwgZXhwcmVzc2lvbi4gRm9yIHRoaXMgcmVhc29uLCBTUUwgc2hvdWxkIG5vdCBiZSB1c2VkIHRvIHBlcnNpc3QgZmlsdGVyIHN0YXRlIGJ1dCByYXRoZXIgaXRzIHVzZSBzaG91bGQgYmUgbGltaXRlZCB0byBnZW5lcmF0aW5nIGEgZmlsdGVyIHF1ZXJ5IGZvciBhIHJlbW90ZSBkYXRhIHNlcnZlci5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEdldCBhIHJlcHJlc2VudGF0aW9uIG9mIGZpbHRlciBzdGF0ZS5cbiAgICAgKiBAZGVzYyBDYWxsaW5nIHRoaXMgb24gdGhlIHJvb3Qgd2lsbCBnZXQgdGhlIGVudGlyZSB0cmVlJ3Mgc3RhdGU7IGNhbGxpbmcgdGhpcyBvbiBhbnkgc3VidHJlZSB3aWxsIGdldCBqdXN0IHRoYXQgc3VidHJlZSdzIHN0YXRlLlxuICAgICAqXG4gICAgICogT25seSBfZXNzZW50aWFsXyBwcm9wZXJ0aWVzIHdpbGwgYmUgb3V0cHV0OlxuICAgICAqXG4gICAgICogMS4gYEZpbHRlclRyZWVgIG5vZGVzIHdpbGwgb3V0cHV0IGF0IGxlYXN0IDIgcHJvcGVydGllczpcbiAgICAgKiAgICAqIGBvcGVyYXRvcmBcbiAgICAgKiAgICAqIGBjaGlsZHJlbmBcbiAgICAgKiAyLiBgRmlsdGVyTGVhZmAgbm9kZXMgd2lsbCBvdXRwdXQgKHZpYSB7QGxpbmsgRmlsdGVyTGVhZiNnZXRTdGF0ZXxnZXRTdGF0ZX0pIGF0IGxlYXN0IDMgcHJvcGVydGllcywgb25lIHByb3BlcnR5IGZvciBlYWNoIGl0ZW0gaW4gaXQncyBgdmlld2A6XG4gICAgICogICAgKiBgY29sdW1uYFxuICAgICAqICAgICogYG9wZXJhdG9yYFxuICAgICAqICAgICogYG9wZXJhbmRgXG4gICAgICogMy4gQWRkaXRpb25hbCBub2RlIHByb3BlcnRpZXMgd2lsbCBiZSBvdXRwdXQgd2hlbjpcbiAgICAgKiAgICAxLiBXaGVuIHRoZSBwcm9wZXJ0eSB3YXMgKipOT1QqKiBleHRlcm5hbGx5IHNvdXJjZWQ6XG4gICAgICogICAgICAgMS4gRGlkICpub3QqIGNvbWUgZnJvbSB0aGUgYG9wdGlvbnNgIG9iamVjdCBvbiBub2RlIGluc3RhbnRpYXRpb24uXG4gICAgICogICAgICAgMi4gRGlkICpub3QqIGNvbWUgZnJvbSB0aGUgb3B0aW9ucyBzY2hlbWEgYGRlZmF1bHRgIG9iamVjdCwgaWYgYW55LlxuICAgICAqICAgIDIuICoqQU5EKiogYXQgbGVhc3Qgb25lIG9mIHRoZSBmb2xsb3dpbmcgaXMgdHJ1ZTpcbiAgICAgKiAgICAgICAxLiBXaGVuIGl0J3MgYW4gXCJvd25cIiBwcm9wZXJ0eS5cbiAgICAgKiAgICAgICAyLiBXaGVuIGl0cyB2YWx1ZSBkaWZmZXJzIGZyb20gaXQncyBwYXJlbnQncy5cbiAgICAgKiAgICAgICAzLiBXaGVuIHRoaXMgaXMgdGhlIHJvb3Qgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLnNxbElkUXRzXSAtIFdoZW4gYG9wdGlvbnMuc3ludGF4ID09PSAnU1FMJ2AsIGZvcndhcmRlZCB0byBgY29uZGl0aW9uYWxzLnB1c2hTcWxJZFF0cygpYC5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fHN0cmluZ30gUmV0dXJucyBvYmplY3Qgd2hlbiBgb3B0aW9ucy5zeW50YXggPT09ICdvYmplY3QnYDsgb3RoZXJ3aXNlIHJldHVybnMgc3RyaW5nLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAnJyxcbiAgICAgICAgICAgIHN5bnRheCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggfHwgJ29iamVjdCc7XG5cbiAgICAgICAgc3dpdGNoIChzeW50YXgpIHtcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdW5zdHJ1bmdpZnkuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnSlNPTic6XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkodGhpcywgbnVsbCwgb3B0aW9ucyAmJiBvcHRpb25zLnNwYWNlKSB8fCAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnU1FMJzpcbiAgICAgICAgICAgICAgICB2YXIgbGV4ZW1lID0gb3BlcmF0b3JzW3RoaXMub3BlcmF0b3JdLlNRTDtcblxuICAgICAgICAgICAgICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCwgaWR4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvcCA9IGlkeCA/ICcgJyArIGxleGVtZS5vcCArICcgJyA6ICcnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBGaWx0ZXJMZWFmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gb3AgKyBjaGlsZC5nZXRTdGF0ZShvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBvcCArIGdldFN0YXRlLmNhbGwoY2hpbGQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGxleGVtZS5iZWcgKyByZXN1bHQgKyBsZXhlbWUuZW5kO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgdGhpcy5FcnJvcignVW5rbm93biBzeW50YXggb3B0aW9uIFwiJyArIHN5bnRheCArICdcIicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgdG9KU09OOiBmdW5jdGlvbiB0b0pTT04oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIHN0YXRlID0ge1xuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiB0aGlzLm9wZXJhdG9yLFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxuICAgICAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgICAgIHN0YXRlLmNoaWxkcmVuLnB1c2goY2hpbGQgaW5zdGFuY2VvZiBGaWx0ZXJMZWFmID8gY2hpbGQgOiB0b0pTT04uY2FsbChjaGlsZCkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBfKEZpbHRlck5vZGUub3B0aW9uc1NjaGVtYSkuZWFjaChmdW5jdGlvbihvcHRpb25TY2hlbWEsIGtleSkge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHNlbGZba2V5XSAmJiAvLyB0aGVyZSBpcyBhIHN0YW5kYXJkIG9wdGlvbiBvbiB0aGUgbm9kZSB3aGljaCBtYXkgbmVlZCB0byBiZSBvdXRwdXRcbiAgICAgICAgICAgICAgICAhc2VsZi5kb250UGVyc2lzdFtrZXldICYmIChcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uU2NoZW1hLm93biB8fCAvLyBvdXRwdXQgYmVjYXVzZSBpdCdzIGFuIFwib3duXCIgb3B0aW9uIChiZWxvbmdzIHRvIHRoZSBub2RlKVxuICAgICAgICAgICAgICAgICAgICAhc2VsZi5wYXJlbnQgfHwgLy8gb3V0cHV0IGJlY2F1c2UgaXQncyB0aGUgcm9vdCBub2RlXG4gICAgICAgICAgICAgICAgICAgIHNlbGZba2V5XSAhPT0gc2VsZi5wYXJlbnRba2V5XSAvLyBvdXRwdXQgYmVjYXVzZSBpdCBkaWZmZXJzIGZyb20gaXRzIHBhcmVudCdzIHZlcnNpb25cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZVtrZXldID0gc2VsZltrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCB0aGUgY2FzZSBzZW5zaXRpdml0eSBvZiBmaWx0ZXIgdGVzdHMgYWdhaW5zdCBkYXRhLlxuICAgICAqIEBkZXNjIENhc2Ugc2Vuc2l0aXZpdHkgcGVydGFpbnMgdG8gc3RyaW5nIGNvbXBhcmVzIG9ubHkuIFRoaXMgaW5jbHVkZXMgdW50eXBlZCBjb2x1bW5zLCBjb2x1bW5zIHR5cGVkIGFzIHN0cmluZ3MsIHR5cGVkIGNvbHVtbnMgY29udGFpbmluZyBkYXRhIHRoYXQgY2Fubm90IGJlIGNvZXJjZWQgdG8gdHlwZSBvciB3aGVuIHRoZSBmaWx0ZXIgZXhwcmVzc2lvbiBvcGVyYW5kIGNhbm5vdCBiZSBjb2VyY2VkLlxuICAgICAqXG4gICAgICogTk9URTogVGhpcyBpcyBhIHNoYXJlZCBwcm9wZXJ0eSBhbmQgYWZmZWN0cyBhbGwgZmlsdGVyLXRyZWUgaW5zdGFuY2VzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgY29kZSBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzU2Vuc2l0aXZlXG4gICAgICogQG1lbWJlck9mIEZpbHRlcnRyZWUjLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldCBjYXNlU2Vuc2l0aXZlRGF0YShpc1NlbnNpdGl2ZSkge1xuICAgICAgICB2YXIgdG9TdHJpbmcgPSBpc1NlbnNpdGl2ZSA/IHRvU3RyaW5nQ2FzZVNlbnNpdGl2ZSA6IHRvU3RyaW5nQ2FzZUluc2Vuc2l0aXZlO1xuICAgICAgICBGaWx0ZXJMZWFmLnNldFRvU3RyaW5nKHRvU3RyaW5nKTtcbiAgICB9XG5cbn0pO1xuXG5mdW5jdGlvbiB0b1N0cmluZ0Nhc2VJbnNlbnNpdGl2ZShzKSB7IHJldHVybiAocyArICcnKS50b1VwcGVyQ2FzZSgpOyB9XG5mdW5jdGlvbiB0b1N0cmluZ0Nhc2VTZW5zaXRpdmUocykgeyByZXR1cm4gcyArICcnOyB9XG5cbi8vIFNvbWUgZXZlbnQgaGFuZGxlcnMgYm91bmQgdG8gRmlsdGVyVHJlZSBvYmplY3RcblxuZnVuY3Rpb24gb25jaGFuZ2UoZXZ0KSB7IC8vIGNhbGxlZCBpbiBjb250ZXh0XG4gICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0O1xuICAgIGlmIChjdHJsLnBhcmVudEVsZW1lbnQgPT09IHRoaXMuZWwpIHtcbiAgICAgICAgaWYgKGN0cmwudmFsdWUgPT09ICdzdWJleHAnKSB7XG4gICAgICAgICAgICB0aGlzLmNoaWxkcmVuLnB1c2gobmV3IEZpbHRlclRyZWUoe1xuICAgICAgICAgICAgICAgIHBhcmVudDogdGhpc1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hZGQoe1xuICAgICAgICAgICAgICAgIHN0YXRlOiB7IGVkaXRvcjogY3RybC52YWx1ZSB9LFxuICAgICAgICAgICAgICAgIGZvY3VzOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjdHJsLnNlbGVjdGVkSW5kZXggPSAwO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25UcmVlT3BDbGljayhldnQpIHsgLy8gY2FsbGVkIGluIGNvbnRleHRcbiAgICB2YXIgY3RybCA9IGV2dC50YXJnZXQ7XG5cbiAgICBpZiAoY3RybC5jbGFzc05hbWUgPT09ICdmaWx0ZXItdHJlZS1vcC1jaG9pY2UnKSB7XG4gICAgICAgIHRoaXMub3BlcmF0b3IgPSBjdHJsLnZhbHVlO1xuXG4gICAgICAgIC8vIGRpc3BsYXkgc3RyaWtlLXRocm91Z2hcbiAgICAgICAgdmFyIHJhZGlvQnV0dG9ucyA9IHRoaXMuZWwucXVlcnlTZWxlY3RvckFsbCgnbGFiZWw+aW5wdXQuZmlsdGVyLXRyZWUtb3AtY2hvaWNlW25hbWU9JyArIGN0cmwubmFtZSArICddJyk7XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwocmFkaW9CdXR0b25zLCBmdW5jdGlvbihjdHJsKSB7XG4gICAgICAgICAgICBjdHJsLnBhcmVudEVsZW1lbnQuc3R5bGUudGV4dERlY29yYXRpb24gPSBjdHJsLmNoZWNrZWQgPyAnbm9uZScgOiAnbGluZS10aHJvdWdoJztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gZGlzcGxheSBvcGVyYXRvciBiZXR3ZWVuIGZpbHRlcnMgYnkgYWRkaW5nIG9wZXJhdG9yIHN0cmluZyBhcyBhIENTUyBjbGFzcyBvZiB0aGlzIHRyZWVcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9wZXJhdG9ycykge1xuICAgICAgICAgICAgdGhpcy5lbC5jbGFzc0xpc3QucmVtb3ZlKGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbC5jbGFzc0xpc3QuYWRkKHRoaXMub3BlcmF0b3IpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBUaHJvd3MgZXJyb3IgaWYgaW52YWxpZCBleHByZXNzaW9uIHRyZWUuXG4gKiBDYXVnaHQgYnkge0BsaW5rIEZpbHRlclRyZWUjaW52YWxpZHxGaWx0ZXJUcmVlLnByb3RvdHlwZS5pbnZhbGlkKCl9LlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mb2N1cz1mYWxzZV0gLSBNb3ZlIGZvY3VzIHRvIG9mZmVuZGluZyBjb250cm9sLlxuICogQHJldHVybnMge3VuZGVmaW5lZH0gaWYgdmFsaWRcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGludmFsaWQob3B0aW9ucykgeyAvLyBjYWxsZWQgaW4gY29udGV4dFxuICAgIC8vaWYgKHRoaXMgaW5zdGFuY2VvZiBGaWx0ZXJUcmVlICYmICF0aGlzLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgIC8vICAgIHRocm93IG5ldyB0aGlzLkVycm9yKCdFbXB0eSBzdWJleHByZXNzaW9uIChubyBmaWx0ZXJzKS4nKTtcbiAgICAvL31cblxuICAgIHRoaXMuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZCkge1xuICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBGaWx0ZXJMZWFmKSB7XG4gICAgICAgICAgICBjaGlsZC5pbnZhbGlkKG9wdGlvbnMpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICAgICAgaW52YWxpZC5jYWxsKGNoaWxkLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5GaWx0ZXJUcmVlLmV4dGVuc2lvbnMgPSB7XG4gICAgQ29sdW1uczogcmVxdWlyZSgnLi9leHRlbnNpb25zL2NvbHVtbnMnKVxufTtcblxuLy8gbW9kdWxlIGluaXRpYWxpemF0aW9uXG5GaWx0ZXJUcmVlLnByb3RvdHlwZS5jYXNlU2Vuc2l0aXZlRGF0YSA9IHRydWU7ICAvLyBkZWZhdWx0IGlzIGNhc2Utc2Vuc2l0aXZlIHdoaWNoIGlzIG1vcmUgZWZmaWNpZW50OyBtYXkgYmUgcmVzZXQgYXQgd2lsbFxuXG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyVHJlZTtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciB0ZW1wbGV4ID0gcmVxdWlyZSgndGVtcGxleCcpO1xuXG52YXIgdGVtcGxhdGVzID0gcmVxdWlyZSgnLi4vaHRtbCcpO1xuXG52YXIgZW5jb2RlcnMgPSAvXFx7KFxcZCspXFw6ZW5jb2RlXFx9L2c7XG5cbmZ1bmN0aW9uIFRlbXBsYXRlcygpIHt9XG52YXIgY29uc3RydWN0b3IgPSBUZW1wbGF0ZXMucHJvdG90eXBlLmNvbnN0cnVjdG9yO1xuVGVtcGxhdGVzLnByb3RvdHlwZSA9IHRlbXBsYXRlcztcblRlbXBsYXRlcy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBjb25zdHJ1Y3RvcjsgLy8gcmVzdG9yZSBpdFxuVGVtcGxhdGVzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbih0ZW1wbGF0ZU5hbWUpIHsgLy8gbWl4IGl0IGluXG4gICAgdmFyIGtleXMsXG4gICAgICAgIG1hdGNoZXMgPSB7fSxcbiAgICAgICAgdGVtcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICAgICAgICB0ZXh0ID0gdGhpc1t0ZW1wbGF0ZU5hbWVdLFxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIGVuY29kZXJzLmxhc3RJbmRleCA9IDA7XG5cbiAgICB3aGlsZSAoKGtleXMgPSBlbmNvZGVycy5leGVjKHRleHQpKSkge1xuICAgICAgICBtYXRjaGVzW2tleXNbMV1dID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBrZXlzID0gT2JqZWN0LmtleXMobWF0Y2hlcyk7XG5cbiAgICBpZiAoa2V5cy5sZW5ndGgpIHtcbiAgICAgICAga2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICAgICAgdGVtcC50ZXh0Q29udGVudCA9IGFyZ3Nba2V5XTtcbiAgICAgICAgICAgIGFyZ3Nba2V5XSA9IHRlbXAuaW5uZXJIVE1MO1xuICAgICAgICB9KTtcbiAgICAgICAgdGV4dCA9IHRleHQucmVwbGFjZShlbmNvZGVycywgJ3skMX0nKTtcbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IHRlbXBsZXguYXBwbHkodGhpcywgW3RleHRdLmNvbmNhdChhcmdzKSk7XG5cbiAgICAvLyBpZiBvbmx5IG9uZSBIVE1MRWxlbWVudCwgcmV0dXJuIGl0OyBvdGhlcndpc2UgZW50aXJlIGxpc3Qgb2Ygbm9kZXNcbiAgICByZXR1cm4gdGVtcC5jaGlsZHJlbi5sZW5ndGggPT09IDEgJiYgdGVtcC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMVxuICAgICAgICA/IHRlbXAuZmlyc3RDaGlsZFxuICAgICAgICA6IHRlbXAuY2hpbGROb2Rlcztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi4vQ29uZGl0aW9uYWxzJyk7XG52YXIgRmlsdGVyTGVhZiA9IHJlcXVpcmUoJy4uL0ZpbHRlckxlYWYnKTtcblxuLyoqXG4gKiBAc3VtbWFyeSBQcm90b3R5cGUgYWRkaXRpb25zIG9iamVjdCBmb3IgZXh0ZW5kaW5nIHtAbGluayBGaWx0ZXJMZWFmfS5cbiAqIEBkZXNjIFJlc3VsdGluZyBvYmplY3QgaXMgc2ltaWxhciB0byB7QGxpbmsgRmlsdGVyTGVhZn0gZXhjZXB0OlxuICogMS4gVGhlIGBvcGVyYW5kYCBwcm9wZXJ0eSBuYW1lcyBhbm90aGVyIGNvbHVtbiByYXRoZXIgdGhhbiBjb250YWlucyBhIGxpdGVyYWwuXG4gKiAyLiBPcGVyYXRvcnMgYXJlIGxpbWl0ZWQgdG8gZXF1YWxpdHksIGluZXF1YWxpdGllcywgYW5kIHNldHMgKElOL05PVCBJTikuIE9taXR0ZWQgYXJlIHRoZSBzdHJpbmcgYW5kIHBhdHRlcm4gc2NhbnMgKEJFR0lOUy9OT1QgQkVHSU5TLCBFTkRTL05PVCBFTkRTLCBDT05UQUlOUy9OT1QgQ09OVEFJTlMsIGFuZCBMSUtFL05PVCBMSUtFKS5cbiAqXG4gKiBAZXh0ZW5kcyBGaWx0ZXJMZWFmXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGlkZW50aWZpZXIgLSBOYW1lIG9mIGNvbHVtbiAobWVtYmVyIG9mIGRhdGEgcm93IG9iamVjdCkgdG8gY29tcGFyZSBhZ2FpbnN0IHRoaXMgY29sdW1uIChtZW1iZXIgb2YgZGF0YSByb3cgb2JqZWN0IG5hbWVkIGJ5IGBjb2x1bW5gKS5cbiAqL1xudmFyIENvbHVtbkxlYWYgPSB7XG4gICAgbmFtZTogJ2NvbHVtbiA9IGNvbHVtbicsIC8vIGRpc3BsYXkgc3RyaW5nIGZvciBkcm9wLWRvd25cblxuICAgIGNyZWF0ZVZpZXc6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBDcmVhdGUgdGhlIGB2aWV3YCBoYXNoIGFuZCBpbnNlcnQgdGhlIHRocmVlIGRlZmF1bHQgZWxlbWVudHMgKGBjb2x1bW5gLCBgb3BlcmF0b3JgLCBgb3BlcmFuZGApIGludG8gYC5lbGBcbiAgICAgICAgRmlsdGVyTGVhZi5wcm90b3R5cGUuY3JlYXRlVmlldy5jYWxsKHRoaXMpO1xuXG4gICAgICAgIC8vIFJlcGxhY2UgdGhlIGBvcGVyYW5kYCBlbGVtZW50IGZyb20gdGhlIGB2aWV3YCBoYXNoXG4gICAgICAgIHZhciBvbGRPcGVyYW5kID0gdGhpcy52aWV3Lm9wZXJhbmQsXG4gICAgICAgICAgICBuZXdPcGVyYW5kID0gdGhpcy52aWV3Lm9wZXJhbmQgPSB0aGlzLm1ha2VFbGVtZW50KHRoaXMucm9vdC5zY2hlbWEsICdjb2x1bW4nLCB0aGlzLnNvcnRDb2x1bW5NZW51KTtcblxuICAgICAgICAvLyBSZXBsYWNlIHRoZSBvcGVyYW5kIGVsZW1lbnQgd2l0aCB0aGUgbmV3IG9uZS4gVGhlcmUgYXJlIG5vIGV2ZW50IGxpc3RlbmVycyB0byB3b3JyeSBhYm91dC5cbiAgICAgICAgdGhpcy5lbC5yZXBsYWNlQ2hpbGQobmV3T3BlcmFuZCwgb2xkT3BlcmFuZCk7XG4gICAgfSxcblxuICAgIG1ha2VTcWxPcGVyYW5kOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb25kaXRpb25hbHMubWFrZVNxbElkZW50aWZpZXIodGhpcy5vcGVyYW5kKTtcbiAgICB9LFxuXG4gICAgb3BNZW51OiBbXG4gICAgICAgIENvbmRpdGlvbmFscy5ncm91cHMuZXF1YWxpdHksXG4gICAgICAgIENvbmRpdGlvbmFscy5ncm91cHMuaW5lcXVhbGl0aWVzLFxuICAgICAgICBDb25kaXRpb25hbHMuZ3JvdXBzLnNldHNcbiAgICBdLFxuXG4gICAgcTogZnVuY3Rpb24oZGF0YVJvdykge1xuICAgICAgICByZXR1cm4gdGhpcy52YWxPckZ1bmMuY2FsbChkYXRhUm93LCB0aGlzLm9wZXJhbmQpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sdW1uTGVhZjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJlT3AgPSAvXigoPXw+PT98PFs+PV0/KXwoTk9UICk/KExJS0V8SU4pXFxiKS9pLCAvLyBtYXRjaFsxXVxuICAgIHJlRmxvYXQgPSAvXihbKy1dPyhcXGQrKFxcLlxcZCopP3xcXGQqXFwuXFxkKykoZVsrLV1cXGQrKT8pW15cXGRdPy9pLFxuICAgIHJlTGl0ID0gL14nKFxcZCspJy8sXG4gICAgcmVMaXRBbnl3aGVyZSA9IC8nKFxcZCspJy8sXG4gICAgcmVJbiA9IC9eXFwoKC4qPylcXCkvLFxuICAgIHJlQm9vbCA9IC9eKEFORHxPUilcXGIvaSxcbiAgICByZUdyb3VwID0gL14oTk9UID8pP1xcKC9pO1xuXG52YXIgU1FUID0gJ1xcJyc7XG5cbnZhciBkZWZhdWx0SWRRdHMgPSB7XG4gICAgYmVnOiAnXCInLFxuICAgIGVuZDogJ1wiJ1xufTtcblxuZnVuY3Rpb24gUGFyc2VyU3FsRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5QYXJzZXJTcWxFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5QYXJzZXJTcWxFcnJvci5wcm90b3R5cGUubmFtZSA9ICdQYXJzZXJTcWxFcnJvcic7XG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fSBzcWxJZFF0c09iamVjdFxuICogQGRlc2MgT24gYSBwcmFjdGljYWwgbGV2ZWwsIHRoZSB1c2VmdWwgY2hhcmFjdGVycyBhcmU6XG4gKiAqIFNRTC05MiBzdGFuZGFyZDogXCJkb3VibGUgcXVvdGVzXCJcbiAqICogU1FMIFNlcnZlcjogXCJkb3VibGUgcXVvdGVzXCIgb3IgXFxbc3F1YXJlIGJyYWNrZXRzXFxdXG4gKiAqIG15U1FMOiBcXGB0aWNrIG1hcmtzXFxgXG4gKiBAcHJvcGVydHkge3N0cmluZ30gYmVnIC0gVGhlIG9wZW4gcXVvdGUgY2hhcmFjdGVyLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGVuZCAtIFRoZSBjbG9zZSBxdW90ZSBjaGFyYWN0ZXIuXG4gKi9cblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBzdW1tYXJ5IFN0cnVjdHVyZWQgUXVlcnkgTGFuZ3VhZ2UgKFNRTCkgcGFyc2VyXG4gKiBAYXV0aG9yIEpvbmF0aGFuIEVpdGVuIDxqb25hdGhhbkBvcGVuZmluLmNvbT5cbiAqIEBkZXNjIFRoaXMgaXMgYSBzdWJzZXQgb2YgU1FMIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gc3ludGF4LlxuICpcbiAqIEBzZWUge0BsaW5rIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxNzM1NDUuYXNweCBTUUwgU2VhcmNoIENvbmRpdGlvbn1cbiAqXG4gKiBAcGFyYW0ge21lbnVJdGVtW119IFtvcHRpb25zLnNjaGVtYV0gLSBDb2x1bW4gc2NoZW1hIGZvciBjb2x1bW4gbmFtZSB2YWxpZGF0aW9uLiBUaHJvd3MgYW4gZXJyb3IgaWYgbmFtZSBmYWlscyB2YWxpZGF0aW9uIChidXQgc2VlIGByZXNvbHZlQWxpYXNlc2ApLiBPbWl0IHRvIHNraXAgY29sdW1uIG5hbWUgdmFsaWRhdGlvbi5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucmVzb2x2ZUFsaWFzZXNdIC0gVmFsaWRhdGUgY29sdW1uIGFsaWFzZXMgYWdhaW5zdCBzY2hlbWEgYW5kIHVzZSB0aGUgYXNzb2NpYXRlZCBjb2x1bW4gbmFtZSBpbiB0aGUgcmV0dXJuZWQgZXhwcmVzc2lvbiBzdGF0ZSBvYmplY3QuIFJlcXVpcmVzIGBvcHRpb25zLnNjaGVtYWAuIFRocm93cyBlcnJvciBpZiBubyBzdWNoIGNvbHVtbiBmb3VuZC5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzXSAtIElnbm9yZSBjYXNlIHdoaWxlIHZhbGlkYXRpbmcgY29sdW1uIG5hbWVzIGFuZCBhbGlhc2VzLlxuICogQHBhcmFtIHtzcWxJZFF0c09iamVjdH0gW29wdGlvbnMuc3FsSWRRdHM9e2JlZzonXCInLGVuZDonXCInfV1cbiAqL1xuZnVuY3Rpb24gUGFyc2VyU1FMKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHRoaXMuc2NoZW1hID0gb3B0aW9ucy5zY2hlbWE7XG5cbiAgICB2YXIgaWRRdHMgPSBvcHRpb25zLnNxbElkUXRzIHx8IGRlZmF1bHRJZFF0cztcbiAgICB0aGlzLnJlTmFtZSA9IG5ldyBSZWdFeHAoJ14oJyArIGlkUXRzLmJlZyArICcoLis/KScgKyBpZFF0cy5lbmQgKyAnfChbQS1aX11bQS1aX0BcXFxcJCNdKilcXFxcYiknLCAnaScpOyAvLyBtYXRjaFsyXSB8fCBtYXRjaFszXVxufVxuXG5QYXJzZXJTUUwucHJvdG90eXBlID0ge1xuXG4gICAgY29uc3RydWN0b3I6IFBhcnNlclNRTC5wcm90b3R5cGUuY29uc3RydWN0b3IsXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3FsXG4gICAgICogQHJldHVybnMgeyp9XG4gICAgICogQG1lbWJlck9mIG1vZHVsZTpzcWxTZWFyY2hDb25kaXRpb25cbiAgICAgKi9cbiAgICBwYXJzZTogZnVuY3Rpb24oc3FsKSB7XG4gICAgICAgIHZhciBzdGF0ZTtcblxuICAgICAgICAvLyByZWR1Y2UgYWxsIHJ1bnMgb2Ygd2hpdGUgc3BhY2UgdG8gYSBzaW5nbGUgc3BhY2U7IHRoZW4gdHJpbVxuICAgICAgICBzcWwgPSBzcWwucmVwbGFjZSgvXFxzXFxzKy9nLCAnICcpLnRyaW0oKTtcblxuICAgICAgICBzcWwgPSBzdHJpcExpdGVyYWxzLmNhbGwodGhpcywgc3FsKTtcbiAgICAgICAgc3RhdGUgPSB3YWxrLmNhbGwodGhpcywgc3FsKTtcblxuICAgICAgICBpZiAoIXN0YXRlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IHsgY2hpbGRyZW46IFsgc3RhdGUgXSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHdhbGsodCkge1xuICAgIHZhciBtLCBuYW1lLCBvcCwgb3BlcmFuZCwgZWRpdG9yLCBib29sLCB0b2tlbiwgdG9rZW5zID0gW107XG4gICAgdmFyIGkgPSAwO1xuXG4gICAgdCA9IHQudHJpbSgpO1xuXG4gICAgd2hpbGUgKGkgPCB0Lmxlbmd0aCkge1xuICAgICAgICBtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVHcm91cCk7XG4gICAgICAgIGlmIChtKSB7XG4gICAgICAgICAgICB2YXIgbm90ID0gISFtWzFdO1xuXG4gICAgICAgICAgICBpICs9IG1bMF0ubGVuZ3RoO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IGksIHYgPSAxOyBqIDwgdC5sZW5ndGggJiYgdjsgKytqKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRbal0gPT09ICcoJykge1xuICAgICAgICAgICAgICAgICAgICArK3Y7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0W2pdID09PSAnKScpIHtcbiAgICAgICAgICAgICAgICAgICAgLS12O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHYpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIFwiKVwiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b2tlbiA9IHdhbGsuY2FsbCh0aGlzLCB0LnN1YnN0cihpLCBqIC0gMSAtIGkpKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdG9rZW4gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobm90KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRva2VuLm9wZXJhdG9yICE9PSAnb3Atb3InKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgT1IgaW4gTk9UKC4uLikgc3ViZXhwcmVzc2lvbiBidXQgZm91bmQgJyArIHRva2VuLm9wZXJhdG9yLnN1YnN0cigzKS50b1VwcGVyQ2FzZSgpICsgJy4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG9rZW4ub3BlcmF0b3IgPSAnb3Atbm9yJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaSA9IGo7XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGNvbHVtbjpcblxuICAgICAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHRoaXMucmVOYW1lKTtcbiAgICAgICAgICAgIGlmICghbSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgaWRlbnRpZmllciBvciBxdW90ZWQgaWRlbnRpZmllci4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSBtWzJdIHx8IG1bM107XG4gICAgICAgICAgICBpZiAoIS9eW0EtWl9dL2kudGVzdCh0W2ldKSkgeyBpICs9IDI7IH1cbiAgICAgICAgICAgIGkgKz0gbmFtZS5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIG9wZXJhdG9yOlxuXG4gICAgICAgICAgICBpZiAodFtpXSA9PT0gJyAnKSB7ICsraTsgfVxuICAgICAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlT3ApO1xuICAgICAgICAgICAgaWYgKCFtKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCByZWxhdGlvbmFsIG9wZXJhdG9yLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb3AgPSBtWzFdLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICBpICs9IG9wLmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gb3BlcmFuZDpcblxuICAgICAgICAgICAgZWRpdG9yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKHRbaV0gPT09ICcgJykgeyArK2k7IH1cbiAgICAgICAgICAgIGlmIChtWzRdICYmIG1bNF0udG9VcHBlckNhc2UoKSA9PT0gJ0lOJykge1xuICAgICAgICAgICAgICAgIG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZUluKTtcbiAgICAgICAgICAgICAgICBpZiAoIW0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBwYXJlbnRoZXNpemVkIGxpc3QuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9wZXJhbmQgPSBtWzFdO1xuICAgICAgICAgICAgICAgIGkgKz0gb3BlcmFuZC5sZW5ndGggKyAyO1xuICAgICAgICAgICAgICAgIHdoaWxlICgobSA9IG9wZXJhbmQubWF0Y2gocmVMaXRBbnl3aGVyZSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wZXJhbmQgPSBvcGVyYW5kLnJlcGxhY2UocmVMaXRBbnl3aGVyZSwgdGhpcy5saXRlcmFsc1ttWzFdXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICgobSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlTGl0KSkpIHtcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbVsxXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoICsgMjtcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gdGhpcy5saXRlcmFsc1tvcGVyYW5kXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZUZsb2F0KSkpIHtcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbVsxXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgobSA9IHQuc3Vic3RyKGkpLm1hdGNoKHRoaXMucmVOYW1lKSkpIHtcbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbVsyXSB8fCBtWzNdO1xuICAgICAgICAgICAgICAgIGkgKz0gb3BlcmFuZC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZWRpdG9yID0gJ0NvbHVtbnMnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIG51bWJlciBvciBzdHJpbmcgbGl0ZXJhbCBvciBjb2x1bW4uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNjaGVtYSkge1xuICAgICAgICAgICAgICAgIG5hbWUgPSBsb29rdXAuY2FsbCh0aGlzLCBuYW1lKTtcblxuICAgICAgICAgICAgICAgIGlmIChlZGl0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgb3BlcmFuZCA9IGxvb2t1cC5jYWxsKHRoaXMsIG9wZXJhbmQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdG9rZW4gPSB7XG4gICAgICAgICAgICAgICAgY29sdW1uOiBuYW1lLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiBvcCxcbiAgICAgICAgICAgICAgICBvcGVyYW5kOiBvcGVyYW5kXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgICAgICAgdG9rZW4uZWRpdG9yID0gZWRpdG9yO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdG9rZW5zLnB1c2godG9rZW4pO1xuXG4gICAgICAgIGlmIChpIDwgdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICh0W2ldID09PSAnICcpIHsgKytpOyB9XG4gICAgICAgICAgICBtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVCb29sKTtcbiAgICAgICAgICAgIGlmICghbSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgYm9vbGVhbiBvcGVyYXRvci4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvb2wgPSBtWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpICs9IGJvb2wubGVuZ3RoO1xuICAgICAgICAgICAgYm9vbCA9ICdvcC0nICsgYm9vbDtcbiAgICAgICAgICAgIGlmICh0b2tlbnMub3BlcmF0b3IgJiYgdG9rZW5zLm9wZXJhdG9yICE9PSBib29sKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBzYW1lIGJvb2xlYW4gb3BlcmF0b3IgdGhyb3VnaG91dCBzdWJleHByZXNzaW9uLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW5zLm9wZXJhdG9yID0gYm9vbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0W2ldID09PSAnICcpIHsgKytpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgICAgdG9rZW5zLmxlbmd0aCA9PT0gMSA/IHRva2Vuc1swXSA6IHtcbiAgICAgICAgICAgIG9wZXJhdG9yOiB0b2tlbnMub3BlcmF0b3IsXG4gICAgICAgICAgICBjaGlsZHJlbjogdG9rZW5zXG4gICAgICAgIH1cbiAgICApO1xufVxuXG5mdW5jdGlvbiBsb29rdXAobmFtZSkge1xuICAgIHZhciBpdGVtID0gdGhpcy5zY2hlbWEubG9va3VwKG5hbWUpO1xuXG4gICAgaWYgKCFpdGVtKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcih0aGlzLnJlc29sdmVBbGlhc2VzXG4gICAgICAgICAgICA/ICdFeHBlY3RlZCB2YWxpZCBjb2x1bW4gbmFtZS4nXG4gICAgICAgICAgICA6ICdFeHBlY3RlZCB2YWxpZCBjb2x1bW4gbmFtZSBvciBhbGlhcy4nXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZW0ubmFtZTtcbn1cblxuZnVuY3Rpb24gc3RyaXBMaXRlcmFscyh0KSB7XG4gICAgdmFyIGkgPSAwLCBqID0gMCwgaztcblxuICAgIHRoaXMubGl0ZXJhbHMgPSBbXTtcblxuICAgIHdoaWxlICgoaiA9IHQuaW5kZXhPZihTUVQsIGopKSA+PSAwKSB7XG4gICAgICAgIGsgPSBqO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgICBrID0gdC5pbmRleE9mKFNRVCwgayArIDEpO1xuICAgICAgICAgICAgaWYgKGsgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCAnICsgU1FUICsgJyAoc2luZ2xlIHF1b3RlKS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSB3aGlsZSAodFsrK2tdID09PSBTUVQpO1xuICAgICAgICB0aGlzLmxpdGVyYWxzLnB1c2godC5zbGljZSgrK2osIC0taykucmVwbGFjZSgvJycvZywgU1FUKSk7XG4gICAgICAgIHQgPSB0LnN1YnN0cigwLCBqKSArIGkgKyB0LnN1YnN0cihrKTtcbiAgICAgICAgaiA9IGogKyAxICsgKGkgKyAnJykubGVuZ3RoICsgMTtcbiAgICAgICAgaSsrO1xuICAgIH1cblxuICAgIHJldHVybiB0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlclNRTDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNzc0luamVjdG9yID0gcmVxdWlyZSgnY3NzLWluamVjdG9yJyk7XG5cbnZhciBjc3M7IC8vIGRlZmluZWQgYnkgY29kZSBpbnNlcnRlZCBieSBndWxwZmlsZSBiZXR3ZWVuIGZvbGxvd2luZyBjb21tZW50c1xuLyogaW5qZWN0OmNzcyAqL1xuY3NzID0gJy5maWx0ZXItdHJlZXtmb250LWZhbWlseTpzYW5zLXNlcmlmO2ZvbnQtc2l6ZToxMHB0O2xpbmUtaGVpZ2h0OjEuNWVtfS5maWx0ZXItdHJlZSBsYWJlbHtmb250LXdlaWdodDo0MDB9LmZpbHRlci10cmVlIGlucHV0W3R5cGU9Y2hlY2tib3hdLC5maWx0ZXItdHJlZSBpbnB1dFt0eXBlPXJhZGlvXXttYXJnaW4tbGVmdDozcHg7bWFyZ2luLXJpZ2h0OjNweH0uZmlsdGVyLXRyZWUgb2x7bWFyZ2luLXRvcDowfS5maWx0ZXItdHJlZT5zZWxlY3R7ZmxvYXQ6cmlnaHQ7Ym9yZGVyOjFweCBkb3R0ZWQgZ3JleTtiYWNrZ3JvdW5kLWNvbG9yOnRyYW5zcGFyZW50O2JveC1zaGFkb3c6bm9uZX0uZmlsdGVyLXRyZWUtcmVtb3ZlLWJ1dHRvbntkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDoxNXB4O2hlaWdodDoxNXB4O2JvcmRlci1yYWRpdXM6OHB4O2JhY2tncm91bmQtY29sb3I6I2U4ODtmb250LXNpemU6MTEuNXB4O2NvbG9yOiNmZmY7dGV4dC1hbGlnbjpjZW50ZXI7bGluZS1oZWlnaHQ6bm9ybWFsO2ZvbnQtc3R5bGU6bm9ybWFsO2ZvbnQtZmFtaWx5OnNhbnMtc2VyaWY7bWFyZ2luLXJpZ2h0OjRweDtjdXJzb3I6cG9pbnRlcn0uZmlsdGVyLXRyZWUtcmVtb3ZlLWJ1dHRvbjpob3ZlcntiYWNrZ3JvdW5kLWNvbG9yOnRyYW5zcGFyZW50O2NvbG9yOiNlODg7Zm9udC13ZWlnaHQ6NzAwO2JveC1zaGFkb3c6cmVkIDAgMCAycHggaW5zZXR9LmZpbHRlci10cmVlLXJlbW92ZS1idXR0b246OmJlZm9yZXtjb250ZW50OlxcJ1xcXFxkN1xcJ30uZmlsdGVyLXRyZWUgbGk6OmFmdGVye2ZvbnQtc2l6ZTo3MCU7Zm9udC1zdHlsZTppdGFsaWM7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOiMwODB9LmZpbHRlci10cmVlPm9sPmxpOmxhc3QtY2hpbGQ6OmFmdGVye2Rpc3BsYXk6bm9uZX0ub3AtYW5kPm9sLC5vcC1ub3I+b2wsLm9wLW9yPm9se3BhZGRpbmctbGVmdDo1cHg7bWFyZ2luLWxlZnQ6MjdweH0ub3Atb3I+b2w+bGk6OmFmdGVye21hcmdpbi1sZWZ0OjIuNWVtO2NvbnRlbnQ6XFwn4oCUIE9SIOKAlFxcJ30ub3AtYW5kPm9sPmxpOjphZnRlcnttYXJnaW4tbGVmdDoyLjVlbTtjb250ZW50OlxcJ+KAlCBBTkQg4oCUXFwnfS5vcC1ub3I+b2w+bGk6OmFmdGVye21hcmdpbi1sZWZ0OjIuNWVtO2NvbnRlbnQ6XFwn4oCUIE5PUiDigJRcXCd9LmZpbHRlci10cmVlLWVkaXRvcj4qe2ZvbnQtd2VpZ2h0OjcwMH0uZmlsdGVyLXRyZWUtZWRpdG9yPnNwYW57Zm9udC1zaXplOnNtYWxsZXJ9LmZpbHRlci10cmVlLWVkaXRvcj5pbnB1dFt0eXBlPXRleHRde3dpZHRoOjhlbTtwYWRkaW5nOjFweCA1cHggMnB4fS5maWx0ZXItdHJlZS13YXJuaW5ne2JhY2tncm91bmQtY29sb3I6I2ZmYyFpbXBvcnRhbnQ7Ym9yZGVyLWNvbG9yOiNlZGIhaW1wb3J0YW50O2ZvbnQtd2VpZ2h0OjQwMCFpbXBvcnRhbnR9LmZpbHRlci10cmVlLWVycm9ye2JhY2tncm91bmQtY29sb3I6I2ZjYyFpbXBvcnRhbnQ7Ym9yZGVyLWNvbG9yOiNjOTkhaW1wb3J0YW50O2ZvbnQtd2VpZ2h0OjQwMCFpbXBvcnRhbnR9LmZpbHRlci10cmVlLWRlZmF1bHQ+OmVuYWJsZWR7bWFyZ2luOjAgLjRlbTtiYWNrZ3JvdW5kLWNvbG9yOiNkZGQ7Ym9yZGVyOjFweCBzb2xpZCB0cmFuc3BhcmVudH0uZmlsdGVyLXRyZWUuZmlsdGVyLXRyZWUtdHlwZS1jb2x1bW4tZmlsdGVycz5vbD5saTpub3QoOmxhc3QtY2hpbGQpe3BhZGRpbmctYm90dG9tOi43NWVtO2JvcmRlci1ib3R0b206M3B4IGRvdWJsZSAjMDgwO21hcmdpbi1ib3R0b206Ljc1ZW19LmZpbHRlci10cmVlIC5mb290bm90ZXN7bWFyZ2luOjAgMCA2cHg7Zm9udC1zaXplOjhwdDtmb250LXdlaWdodDo0MDA7bGluZS1oZWlnaHQ6bm9ybWFsO3doaXRlLXNwYWNlOm5vcm1hbDtjb2xvcjojYzAwfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVzPnB7bWFyZ2luOjB9LmZpbHRlci10cmVlIC5mb290bm90ZXM+dWx7bWFyZ2luOi0zcHggMCAwO3BhZGRpbmctbGVmdDoxN3B4O3RleHQtaW5kZXg6LTZweH0uZmlsdGVyLXRyZWUgLmZvb3Rub3Rlcz51bD5saXttYXJnaW46MnB4IDB9LmZpbHRlci10cmVlIC5mb290bm90ZXMgLmZpZWxkLW5hbWUsLmZpbHRlci10cmVlIC5mb290bm90ZXMgLmZpZWxkLXZhbHVle2ZvbnQtd2VpZ2h0OjcwMDtmb250LXN0eWxlOm5vcm1hbH0uZmlsdGVyLXRyZWUgLmZvb3Rub3RlcyAuZmllbGQtdmFsdWV7Zm9udC1mYW1pbHk6bW9ub3NwYWNlO2NvbG9yOiMwMDA7YmFja2dyb3VuZC1jb2xvcjojZGRkO3BhZGRpbmc6MCA1cHg7bWFyZ2luOjAgM3B4O2JvcmRlci1yYWRpdXM6M3B4fSc7XG4vKiBlbmRpbmplY3QgKi9cblxubW9kdWxlLmV4cG9ydHMgPSBjc3NJbmplY3Rvci5iaW5kKHRoaXMsIGNzcywgJ2ZpbHRlci10cmVlLWJhc2UnKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqIEB0eXBlZGVmIHtmdW5jdGlvbn0gb3BlcmF0aW9uUmVkdWNlclxuICogQHBhcmFtIHtib29sZWFufSBwXG4gKiBAcGFyYW0ge2Jvb2xlYW59IHFcbiAqIEByZXR1cm5zIHtib29sZWFufSBUaGUgcmVzdWx0IG9mIGFwcGx5aW5nIHRoZSBvcGVyYXRvciB0byB0aGUgdHdvIHBhcmFtZXRlcnMuXG4gKi9cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge29wZXJhdGlvblJlZHVjZXJ9XG4gKi9cbmZ1bmN0aW9uIEFORChwLCBxKSB7XG4gICAgcmV0dXJuIHAgJiYgcTtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge29wZXJhdGlvblJlZHVjZXJ9XG4gKi9cbmZ1bmN0aW9uIE9SKHAsIHEpIHtcbiAgICByZXR1cm4gcCB8fCBxO1xufVxuXG4vKiogQHR5cGVkZWYge29iZWpjdH0gdHJlZU9wZXJhdG9yXG4gKiBAZGVzYyBFYWNoIGB0cmVlT3BlcmF0b3JgIG9iamVjdCBkZXNjcmliZXMgdHdvIHRoaW5nczpcbiAqXG4gKiAxLiBIb3cgdG8gdGFrZSB0aGUgdGVzdCByZXN1bHRzIG9mIF9uXyBjaGlsZCBub2RlcyBieSBhcHBseWluZyB0aGUgb3BlcmF0b3IgdG8gYWxsIHRoZSByZXN1bHRzIHRvIFwicmVkdWNlXCIgaXQgZG93biB0byBhIHNpbmdsZSByZXN1bHQuXG4gKiAyLiBIb3cgdG8gZ2VuZXJhdGUgU1FMIFdIRVJFIGNsYXVzZSBzeW50YXggdGhhdCBhcHBsaWVzIHRoZSBvcGVyYXRvciB0byBfbl8gY2hpbGQgbm9kZXMuXG4gKlxuICogQHByb3BlcnR5IHtvcGVyYXRpb25SZWR1Y2VyfSByZWR1Y2VcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2VlZCAtXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFib3J0IC1cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbmVnYXRlIC1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTUUwub3AgLVxuICogQHByb3BlcnR5IHtzdHJpbmd9IFNRTC5iZWcgLVxuICogQHByb3BlcnR5IHtzdHJpbmd9IFNRTC5lbmQgLVxuICovXG5cbi8qKiBBIGhhc2ggb2Yge0BsaW5rIHRyZWVPcGVyYXRvcn0gb2JqZWN0cy5cbiAqIEB0eXBlIHtvYmplY3R9XG4gKi9cbnZhciB0cmVlT3BlcmF0b3JzID0ge1xuICAgICdvcC1hbmQnOiB7XG4gICAgICAgIHJlZHVjZTogQU5ELFxuICAgICAgICBzZWVkOiB0cnVlLFxuICAgICAgICBhYm9ydDogZmFsc2UsXG4gICAgICAgIG5lZ2F0ZTogZmFsc2UsXG4gICAgICAgIFNRTDoge1xuICAgICAgICAgICAgb3A6ICdBTkQnLFxuICAgICAgICAgICAgYmVnOiAnKCcsXG4gICAgICAgICAgICBlbmQ6ICcpJ1xuICAgICAgICB9XG4gICAgfSxcbiAgICAnb3Atb3InOiB7XG4gICAgICAgIHJlZHVjZTogT1IsXG4gICAgICAgIHNlZWQ6IGZhbHNlLFxuICAgICAgICBhYm9ydDogdHJ1ZSxcbiAgICAgICAgbmVnYXRlOiBmYWxzZSxcbiAgICAgICAgU1FMOiB7XG4gICAgICAgICAgICBvcDogJ09SJyxcbiAgICAgICAgICAgIGJlZzogJygnLFxuICAgICAgICAgICAgZW5kOiAnKSdcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ29wLW5vcic6IHtcbiAgICAgICAgcmVkdWNlOiBPUixcbiAgICAgICAgc2VlZDogZmFsc2UsXG4gICAgICAgIGFib3J0OiB0cnVlLFxuICAgICAgICBuZWdhdGU6IHRydWUsXG4gICAgICAgIFNRTDoge1xuICAgICAgICAgICAgb3A6ICdPUicsXG4gICAgICAgICAgICBiZWc6ICdOT1QgKCcsXG4gICAgICAgICAgICBlbmQ6ICcpJ1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSB0cmVlT3BlcmF0b3JzO1xuIiwiLyogb2JqZWN0LWl0ZXJhdG9ycy5qcyAtIE1pbmkgVW5kZXJzY29yZSBsaWJyYXJ5XG4gKiBieSBKb25hdGhhbiBFaXRlblxuICpcbiAqIFRoZSBtZXRob2RzIGJlbG93IG9wZXJhdGUgb24gb2JqZWN0cyAoYnV0IG5vdCBhcnJheXMpIHNpbWlsYXJseVxuICogdG8gVW5kZXJzY29yZSAoaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2NvbGxlY3Rpb25zKS5cbiAqXG4gKiBGb3IgbW9yZSBpbmZvcm1hdGlvbjpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9qb25laXQvb2JqZWN0LWl0ZXJhdG9yc1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBzdW1tYXJ5IFdyYXAgYW4gb2JqZWN0IGZvciBvbmUgbWV0aG9kIGNhbGwuXG4gKiBARGVzYyBOb3RlIHRoYXQgdGhlIGBuZXdgIGtleXdvcmQgaXMgbm90IG5lY2Vzc2FyeS5cbiAqIEBwYXJhbSB7b2JqZWN0fG51bGx8dW5kZWZpbmVkfSBvYmplY3QgLSBgbnVsbGAgb3IgYHVuZGVmaW5lZGAgaXMgdHJlYXRlZCBhcyBhbiBlbXB0eSBwbGFpbiBvYmplY3QuXG4gKiBAcmV0dXJuIHtXcmFwcGVyfSBUaGUgd3JhcHBlZCBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIFdyYXBwZXIob2JqZWN0KSB7XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIFdyYXBwZXIpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcbiAgICB9XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFdyYXBwZXIpKSB7XG4gICAgICAgIHJldHVybiBuZXcgV3JhcHBlcihvYmplY3QpO1xuICAgIH1cbiAgICB0aGlzLm9yaWdpbmFsVmFsdWUgPSBvYmplY3Q7XG4gICAgdGhpcy5vID0gb2JqZWN0IHx8IHt9O1xufVxuXG4vKipcbiAqIEBuYW1lIFdyYXBwZXIuY2hhaW5cbiAqIEBzdW1tYXJ5IFdyYXAgYW4gb2JqZWN0IGZvciBhIGNoYWluIG9mIG1ldGhvZCBjYWxscy5cbiAqIEBEZXNjIENhbGxzIHRoZSBjb25zdHJ1Y3RvciBgV3JhcHBlcigpYCBhbmQgbW9kaWZpZXMgdGhlIHdyYXBwZXIgZm9yIGNoYWluaW5nLlxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdFxuICogQHJldHVybiB7V3JhcHBlcn0gVGhlIHdyYXBwZWQgb2JqZWN0LlxuICovXG5XcmFwcGVyLmNoYWluID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHZhciB3cmFwcGVkID0gV3JhcHBlcihvYmplY3QpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5ldy1jYXBcbiAgICB3cmFwcGVkLmNoYWluaW5nID0gdHJ1ZTtcbiAgICByZXR1cm4gd3JhcHBlZDtcbn07XG5cbldyYXBwZXIucHJvdG90eXBlID0ge1xuICAgIC8qKlxuICAgICAqIFVud3JhcCBhbiBvYmplY3Qgd3JhcHBlZCB3aXRoIHtAbGluayBXcmFwcGVyLmNoYWlufFdyYXBwZXIuY2hhaW4oKX0uXG4gICAgICogQHJldHVybiB7b2JqZWN0fG51bGx8dW5kZWZpbmVkfSBUaGUgdmFsdWUgb3JpZ2luYWxseSB3cmFwcGVkIGJ5IHRoZSBjb25zdHJ1Y3Rvci5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICB2YWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcmlnaW5hbFZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtlYWNoXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jZWFjaCkgbWV0aG9kOiBJdGVyYXRlIG92ZXIgdGhlIG1lbWJlcnMgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCBjYWxsaW5nIGBpdGVyYXRlZSgpYCB3aXRoIGVhY2guXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gaXRlcmF0ZWUgLSBGb3IgZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRocmVlIGFyZ3VtZW50czogYCh2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIHVuZGVmaW5lZDsgYW4gYC5lYWNoYCBsb29wIGNhbm5vdCBiZSBicm9rZW4gb3V0IG9mICh1c2Uge0BsaW5rIFdyYXBwZXIjZmluZHwuZmluZH0gaW5zdGVhZCkuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIHRoaXMgb2JqZWN0LiBJbiBvdGhlciB3b3JkcywgdGhpcyBvYmplY3QgYmVjb21lcyB0aGUgYHRoaXNgIHZhbHVlIGluIHRoZSBjYWxscyB0byBgaXRlcmF0ZWVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4ge1dyYXBwZXJ9IFRoZSB3cmFwcGVkIG9iamVjdCBmb3IgY2hhaW5pbmcuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZWFjaDogZnVuY3Rpb24gKGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBvID0gdGhpcy5vO1xuICAgICAgICBPYmplY3Qua2V5cyhvKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGl0ZXJhdGVlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pO1xuICAgICAgICB9LCBjb250ZXh0IHx8IG8pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbZmluZF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2ZpbmQpIG1ldGhvZDogTG9vayB0aHJvdWdoIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgcmV0dXJuaW5nIHRoZSBmaXJzdCBvbmUgdGhhdCBwYXNzZXMgYSB0cnV0aCB0ZXN0IChgcHJlZGljYXRlYCksIG9yIGB1bmRlZmluZWRgIGlmIG5vIHZhbHVlIHBhc3NlcyB0aGUgdGVzdC4gVGhlIGZ1bmN0aW9uIHJldHVybnMgdGhlIHZhbHVlIG9mIHRoZSBmaXJzdCBhY2NlcHRhYmxlIG1lbWJlciwgYW5kIGRvZXNuJ3QgbmVjZXNzYXJpbHkgdHJhdmVyc2UgdGhlIGVudGlyZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gcHJlZGljYXRlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6IGAodmFsdWUsIGtleSwgb2JqZWN0KWAuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgdHJ1dGh5IGlmIHRoZSBtZW1iZXIgcGFzc2VzIHRoZSB0ZXN0IGFuZCBmYWxzeSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgcHJlZGljYXRlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYHByZWRpY2F0ZWAuIChPdGhlcndpc2UsIHRoZSBgdGhpc2AgdmFsdWUgd2lsbCBiZSB0aGUgdW53cmFwcGVkIG9iamVjdC4pXG4gICAgICogQHJldHVybiB7Kn0gVGhlIGZvdW5kIHByb3BlcnR5J3MgdmFsdWUsIG9yIHVuZGVmaW5lZCBpZiBub3QgZm91bmQuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZmluZDogZnVuY3Rpb24gKHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgdmFyIHJlc3VsdDtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IE9iamVjdC5rZXlzKG8pLmZpbmQoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVkaWNhdGUuY2FsbCh0aGlzLCBvW2tleV0sIGtleSwgbyk7XG4gICAgICAgICAgICB9LCBjb250ZXh0IHx8IG8pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gb1tyZXN1bHRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2ZpbHRlcl0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2ZpbHRlcikgbWV0aG9kOiBMb29rIHRocm91Z2ggZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCByZXR1cm5pbmcgdGhlIHZhbHVlcyBvZiBhbGwgbWVtYmVycyB0aGF0IHBhc3MgYSB0cnV0aCB0ZXN0IChgcHJlZGljYXRlYCksIG9yIGVtcHR5IGFycmF5IGlmIG5vIHZhbHVlIHBhc3NlcyB0aGUgdGVzdC4gVGhlIGZ1bmN0aW9uIGFsd2F5cyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gcHJlZGljYXRlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6IGAodmFsdWUsIGtleSwgb2JqZWN0KWAuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgdHJ1dGh5IGlmIHRoZSBtZW1iZXIgcGFzc2VzIHRoZSB0ZXN0IGFuZCBmYWxzeSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgcHJlZGljYXRlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYHByZWRpY2F0ZWAuIChPdGhlcndpc2UsIHRoZSBgdGhpc2AgdmFsdWUgd2lsbCBiZSB0aGUgdW53cmFwcGVkIG9iamVjdC4pXG4gICAgICogQHJldHVybiB7Kn0gQW4gYXJyYXkgY29udGFpbmluZyB0aGUgZmlsdGVyZWQgdmFsdWVzLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpbHRlcjogZnVuY3Rpb24gKHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXMsIG9ba2V5XSwga2V5LCBvKSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaChvW2tleV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbbWFwXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jbWFwKSBtZXRob2Q6IFByb2R1Y2VzIGEgbmV3IGFycmF5IG9mIHZhbHVlcyBieSBtYXBwaW5nIGVhY2ggdmFsdWUgaW4gbGlzdCB0aHJvdWdoIGEgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24gKGBpdGVyYXRlZWApLiBUaGUgZnVuY3Rpb24gYWx3YXlzIHRyYXZlcnNlcyB0aGUgZW50aXJlIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBpdGVyYXRlZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gaXMgY29uY2F0ZW5hdGVkIHRvIHRoZSBlbmQgb2YgdGhlIG5ldyBhcnJheS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2NvbnRleHRdIC0gSWYgZ2l2ZW4sIGBpdGVyYXRlZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGZpbHRlcmVkIHZhbHVlcy5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBtYXA6IGZ1bmN0aW9uIChpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaXRlcmF0ZWUuY2FsbCh0aGlzLCBvW2tleV0sIGtleSwgbykpO1xuICAgICAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtyZWR1Y2VdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNyZWR1Y2UpIG1ldGhvZDogQm9pbCBkb3duIHRoZSB2YWx1ZXMgb2YgYWxsIHRoZSBtZW1iZXJzIG9mIHRoZSB3cmFwcGVkIG9iamVjdCBpbnRvIGEgc2luZ2xlIHZhbHVlLiBgbWVtb2AgaXMgdGhlIGluaXRpYWwgc3RhdGUgb2YgdGhlIHJlZHVjdGlvbiwgYW5kIGVhY2ggc3VjY2Vzc2l2ZSBzdGVwIG9mIGl0IHNob3VsZCBiZSByZXR1cm5lZCBieSBgaXRlcmF0ZWUoKWAuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gaXRlcmF0ZWUgLSBGb3IgZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIGZvdXIgYXJndW1lbnRzOiBgKG1lbW8sIHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gYmVjb21lcyB0aGUgbmV3IHZhbHVlIG9mIGBtZW1vYCBmb3IgdGhlIG5leHQgaXRlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7Kn0gW21lbW9dIC0gSWYgbm8gbWVtbyBpcyBwYXNzZWQgdG8gdGhlIGluaXRpYWwgaW52b2NhdGlvbiBvZiByZWR1Y2UsIHRoZSBpdGVyYXRlZSBpcyBub3QgaW52b2tlZCBvbiB0aGUgZmlyc3QgZWxlbWVudCBvZiB0aGUgbGlzdC4gVGhlIGZpcnN0IGVsZW1lbnQgaXMgaW5zdGVhZCBwYXNzZWQgYXMgdGhlIG1lbW8gaW4gdGhlIGludm9jYXRpb24gb2YgdGhlIGl0ZXJhdGVlIG9uIHRoZSBuZXh0IGVsZW1lbnQgaW4gdGhlIGxpc3QuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIHRoaXMgb2JqZWN0LiBJbiBvdGhlciB3b3JkcywgdGhpcyBvYmplY3QgYmVjb21lcyB0aGUgYHRoaXNgIHZhbHVlIGluIHRoZSBjYWxscyB0byBgaXRlcmF0ZWVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IFRoZSB2YWx1ZSBvZiBgbWVtb2AgXCJyZWR1Y2VkXCIgYXMgcGVyIGBpdGVyYXRlZWAuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgcmVkdWNlOiBmdW5jdGlvbiAoaXRlcmF0ZWUsIG1lbW8sIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhvKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXksIGlkeCkge1xuICAgICAgICAgICAgICAgIG1lbW8gPSAoIWlkeCAmJiBtZW1vID09PSB1bmRlZmluZWQpID8gb1trZXldIDogaXRlcmF0ZWUobWVtbywgb1trZXldLCBrZXksIG8pO1xuICAgICAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbZXh0ZW5kXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jZXh0ZW5kKSBtZXRob2Q6IENvcHkgYWxsIG9mIHRoZSBwcm9wZXJ0aWVzIGluIGVhY2ggb2YgdGhlIGBzb3VyY2VgIG9iamVjdCBwYXJhbWV0ZXIocykgb3ZlciB0byB0aGUgKHdyYXBwZWQpIGRlc3RpbmF0aW9uIG9iamVjdCAodGh1cyBtdXRhdGluZyBpdCkuIEl0J3MgaW4tb3JkZXIsIHNvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBsYXN0IGBzb3VyY2VgIG9iamVjdCB3aWxsIG92ZXJyaWRlIHByb3BlcnRpZXMgd2l0aCB0aGUgc2FtZSBuYW1lIGluIHByZXZpb3VzIGFyZ3VtZW50cyBvciBpbiB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqID4gVGhpcyBtZXRob2QgY29waWVzIG93biBtZW1iZXJzIGFzIHdlbGwgYXMgbWVtYmVycyBpbmhlcml0ZWQgZnJvbSBwcm90b3R5cGUgY2hhaW4uXG4gICAgICogQHBhcmFtIHsuLi5vYmplY3R8bnVsbHx1bmRlZmluZWR9IHNvdXJjZSAtIFZhbHVlcyBvZiBgbnVsbGAgb3IgYHVuZGVmaW5lZGAgYXJlIHRyZWF0ZWQgYXMgZW1wdHkgcGxhaW4gb2JqZWN0cy5cbiAgICAgKiBAcmV0dXJuIHtXcmFwcGVyfG9iamVjdH0gVGhlIHdyYXBwZWQgZGVzdGluYXRpb24gb2JqZWN0IGlmIGNoYWluaW5nIGlzIGluIGVmZmVjdDsgb3RoZXJ3aXNlIHRoZSB1bndyYXBwZWQgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGV4dGVuZDogZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5mb3JFYWNoKGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgICAgICAgIGlmIChvYmplY3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIG9ba2V5XSA9IG9iamVjdFtrZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmNoYWluaW5nID8gdGhpcyA6IG87XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2V4dGVuZE93bl0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2V4dGVuZE93bikgbWV0aG9kOiBMaWtlIHtAbGluayBXcmFwcGVyI2V4dGVuZHxleHRlbmR9LCBidXQgb25seSBjb3BpZXMgaXRzIFwib3duXCIgcHJvcGVydGllcyBvdmVyIHRvIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXG4gICAgICogQHBhcmFtIHsuLi5vYmplY3R8bnVsbHx1bmRlZmluZWR9IHNvdXJjZSAtIFZhbHVlcyBvZiBgbnVsbGAgb3IgYHVuZGVmaW5lZGAgYXJlIHRyZWF0ZWQgYXMgZW1wdHkgcGxhaW4gb2JqZWN0cy5cbiAgICAgKiBAcmV0dXJuIHtXcmFwcGVyfG9iamVjdH0gVGhlIHdyYXBwZWQgZGVzdGluYXRpb24gb2JqZWN0IGlmIGNoYWluaW5nIGlzIGluIGVmZmVjdDsgb3RoZXJ3aXNlIHRoZSB1bndyYXBwZWQgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGV4dGVuZE93bjogZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKS5mb3JFYWNoKGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgICAgICAgIFdyYXBwZXIob2JqZWN0KS5lYWNoKGZ1bmN0aW9uICh2YWwsIGtleSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5ldy1jYXBcbiAgICAgICAgICAgICAgICBvW2tleV0gPSB2YWw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0aGlzLmNoYWluaW5nID8gdGhpcyA6IG87XG4gICAgfVxufTtcblxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvQXJyYXkvZmluZFxuaWYgKCFBcnJheS5wcm90b3R5cGUuZmluZCkge1xuICAgIEFycmF5LnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24gKHByZWRpY2F0ZSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV4dGVuZC1uYXRpdmVcbiAgICAgICAgaWYgKHRoaXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FycmF5LnByb3RvdHlwZS5maW5kIGNhbGxlZCBvbiBudWxsIG9yIHVuZGVmaW5lZCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgcHJlZGljYXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVkaWNhdGUgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGxpc3QgPSBPYmplY3QodGhpcyk7XG4gICAgICAgIHZhciBsZW5ndGggPSBsaXN0Lmxlbmd0aCA+Pj4gMDtcbiAgICAgICAgdmFyIHRoaXNBcmcgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIHZhciB2YWx1ZTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGxpc3RbaV07XG4gICAgICAgICAgICBpZiAocHJlZGljYXRlLmNhbGwodGhpc0FyZywgdmFsdWUsIGksIGxpc3QpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBXcmFwcGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiogQG1vZHVsZSBvdmVycmlkZXIgKi9cblxuLyoqXG4gKiBNaXhlcyBtZW1iZXJzIG9mIGFsbCBgc291cmNlc2AgaW50byBgdGFyZ2V0YCwgaGFuZGxpbmcgZ2V0dGVycyBhbmQgc2V0dGVycyBwcm9wZXJseS5cbiAqXG4gKiBBbnkgbnVtYmVyIG9mIGBzb3VyY2VzYCBvYmplY3RzIG1heSBiZSBnaXZlbiBhbmQgZWFjaCBpcyBjb3BpZWQgaW4gdHVybi5cbiAqXG4gKiBAZXhhbXBsZVxuICogdmFyIG92ZXJyaWRlciA9IHJlcXVpcmUoJ292ZXJyaWRlcicpO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UxID0geyBiOiAyIH0sIHNvdXJjZTIgPSB7IGM6IDMgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyKHRhcmdldCwgc291cmNlMSwgc291cmNlMik7IC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBhLCBiLCBhbmQgYzsgc291cmNlIG9iamVjdHMgdW50b3VjaGVkXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IG9iamVjdCAtIFRoZSB0YXJnZXQgb2JqZWN0IHRvIHJlY2VpdmUgc291cmNlcy5cbiAqIEBwYXJhbSB7Li4ub2JqZWN0fSBbc291cmNlc10gLSBPYmplY3QocykgY29udGFpbmluZyBtZW1iZXJzIHRvIGNvcHkgdG8gYHRhcmdldGAuIChPbWl0dGluZyBpcyBhIG5vLW9wLilcbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSB0YXJnZXQgb2JqZWN0IChgdGFyZ2V0YClcbiAqL1xuZnVuY3Rpb24gb3ZlcnJpZGVyKHRhcmdldCwgc291cmNlcykgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgbWl4SW4uY2FsbCh0YXJnZXQsIGFyZ3VtZW50c1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbn1cblxuLyoqXG4gKiBNaXggYHRoaXNgIG1lbWJlcnMgaW50byBgdGFyZ2V0YC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQS4gU2ltcGxlIHVzYWdlICh1c2luZyAuY2FsbCk6XG4gKiB2YXIgbWl4SW5UbyA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluVG87XG4gKiB2YXIgdGFyZ2V0ID0geyBhOiAxIH0sIHNvdXJjZSA9IHsgYjogMiB9O1xuICogdGFyZ2V0ID09PSBvdmVycmlkZXIubWl4SW5Uby5jYWxsKHNvdXJjZSwgdGFyZ2V0KTsgLy8gdHJ1ZVxuICogLy8gdGFyZ2V0IG9iamVjdCBub3cgaGFzIGJvdGggYSBhbmQgYjsgc291cmNlIG9iamVjdCB1bnRvdWNoZWRcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQi4gU2VtYW50aWMgdXNhZ2UgKHdoZW4gdGhlIHNvdXJjZSBob3N0cyB0aGUgbWV0aG9kKTpcbiAqIHZhciBtaXhJblRvID0gcmVxdWlyZSgnb3ZlcnJpZGVyJykubWl4SW5UbztcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEgfSwgc291cmNlID0geyBiOiAyLCBtaXhJblRvOiBtaXhJblRvIH07XG4gKiB0YXJnZXQgPT09IHNvdXJjZS5taXhJblRvKHRhcmdldCk7IC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQHRoaXMge29iamVjdH0gVGFyZ2V0LlxuICogQHBhcmFtIHRhcmdldFxuICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QgKGB0YXJnZXRgKVxuICogQG1lbWJlck9mIG1vZHVsZTpvdmVycmlkZXJcbiAqL1xuZnVuY3Rpb24gbWl4SW5Ubyh0YXJnZXQpIHtcbiAgICB2YXIgZGVzY3JpcHRvcjtcbiAgICBmb3IgKHZhciBrZXkgaW4gdGhpcykge1xuICAgICAgICBpZiAoKGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRoaXMsIGtleSkpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogTWl4IGBzb3VyY2VgIG1lbWJlcnMgaW50byBgdGhpc2AuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEEuIFNpbXBsZSB1c2FnZSAodXNpbmcgLmNhbGwpOlxuICogdmFyIG1peEluID0gcmVxdWlyZSgnb3ZlcnJpZGVyJykubWl4SW47XG4gKiB2YXIgdGFyZ2V0ID0geyBhOiAxIH0sIHNvdXJjZSA9IHsgYjogMiB9O1xuICogdGFyZ2V0ID09PSBvdmVycmlkZXIubWl4SW4uY2FsbCh0YXJnZXQsIHNvdXJjZSkgLy8gdHJ1ZVxuICogLy8gdGFyZ2V0IG9iamVjdCBub3cgaGFzIGJvdGggYSBhbmQgYjsgc291cmNlIG9iamVjdCB1bnRvdWNoZWRcbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQi4gU2VtYW50aWMgdXNhZ2UgKHdoZW4gdGhlIHRhcmdldCBob3N0cyB0aGUgbWV0aG9kKTpcbiAqIHZhciBtaXhJbiA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSwgbWl4SW46IG1peEluIH0sIHNvdXJjZSA9IHsgYjogMiB9O1xuICogdGFyZ2V0ID09PSB0YXJnZXQubWl4SW4oc291cmNlKSAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgbm93IGhhcyBib3RoIGEgYW5kIGIgKGFuZCBtaXhJbik7IHNvdXJjZSB1bnRvdWNoZWRcbiAqXG4gKiBAcGFyYW0gc291cmNlXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgdGFyZ2V0IG9iamVjdCAoYHRoaXNgKVxuICogQG1lbWJlck9mIG92ZXJyaWRlclxuICogQG1lbWJlck9mIG1vZHVsZTpvdmVycmlkZXJcbiAqL1xuZnVuY3Rpb24gbWl4SW4oc291cmNlKSB7XG4gICAgdmFyIGRlc2NyaXB0b3I7XG4gICAgZm9yICh2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgICBpZiAoKGRlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHNvdXJjZSwga2V5KSkpIHtcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBrZXksIGRlc2NyaXB0b3IpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xufVxuXG5vdmVycmlkZXIubWl4SW5UbyA9IG1peEluVG87XG5vdmVycmlkZXIubWl4SW4gPSBtaXhJbjtcblxubW9kdWxlLmV4cG9ydHMgPSBvdmVycmlkZXI7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgUkVHRVhQX0lORElSRUNUSU9OID0gL14oXFx3KylcXCgoXFx3KylcXCkkLzsgIC8vIGZpbmRzIGNvbXBsZXRlIHBhdHRlcm4gYShiKSB3aGVyZSBib3RoIGEgYW5kIGIgYXJlIHJlZ2V4IFwid29yZHNcIlxuXG4vKiogQHR5cGVkZWYge29iamVjdH0gdmFsdWVJdGVtXG4gKiBZb3Ugc2hvdWxkIHN1cHBseSBib3RoIGBuYW1lYCBhbmQgYGFsaWFzYCBidXQgeW91IGNvdWxkIG9taXQgb25lIG9yIHRoZSBvdGhlciBhbmQgd2hpY2hldmVyIHlvdSBwcm92aWRlIHdpbGwgYmUgdXNlZCBmb3IgYm90aC5cbiAqID4gSWYgeW91IG9ubHkgZ2l2ZSB0aGUgYG5hbWVgIHByb3BlcnR5LCB5b3UgbWlnaHQgYXMgd2VsbCBqdXN0IGdpdmUgYSBzdHJpbmcgZm9yIHtAbGluayBtZW51SXRlbX0gcmF0aGVyIHRoYW4gdGhpcyBvYmplY3QuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW25hbWU9YWxpYXNdIC0gVmFsdWUgb2YgYHZhbHVlYCBhdHRyaWJ1dGUgb2YgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50LlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFthbGlhcz1uYW1lXSAtIFRleHQgb2YgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50LlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFt0eXBlXSBPbmUgb2YgdGhlIGtleXMgb2YgYHRoaXMuY29udmVydGVyc2AuIElmIG5vdCBvbmUgb2YgdGhlc2UgKGluY2x1ZGluZyBgdW5kZWZpbmVkYCksIGZpZWxkIHZhbHVlcyB3aWxsIGJlIHRlc3RlZCB3aXRoIGEgc3RyaW5nIGNvbXBhcmlzb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtoaWRkZW49ZmFsc2VdXG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R8bWVudUl0ZW1bXX0gc3VibWVudUl0ZW1cbiAqIEBzdW1tYXJ5IEhpZXJhcmNoaWNhbCBhcnJheSBvZiBzZWxlY3QgbGlzdCBpdGVtcy5cbiAqIEBkZXNjIERhdGEgc3RydWN0dXJlIHJlcHJlc2VudGluZyB0aGUgbGlzdCBvZiBgPG9wdGlvbj4uLi48L29wdGlvbj5gIGFuZCBgPG9wdGdyb3VwPi4uLjwvb3B0Z3JvdXA+YCBlbGVtZW50cyB0aGF0IG1ha2UgdXAgYSBgPHNlbGVjdD4uLi48L3NlbGVjdD5gIGVsZW1lbnQuXG4gKlxuICogPiBBbHRlcm5hdGUgZm9ybTogSW5zdGVhZCBvZiBhbiBvYmplY3Qgd2l0aCBhIGBtZW51YCBwcm9wZXJ0eSBjb250YWluaW5nIGFuIGFycmF5LCBtYXkgaXRzZWxmIGJlIHRoYXQgYXJyYXkuIEJvdGggZm9ybXMgaGF2ZSB0aGUgb3B0aW9uYWwgYGxhYmVsYCBwcm9wZXJ0eS5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbbGFiZWxdIC0gRGVmYXVsdHMgdG8gYSBnZW5lcmF0ZWQgc3RyaW5nIG9mIHRoZSBmb3JtIFwiR3JvdXAgblsubV0uLi5cIiB3aGVyZSBlYWNoIGRlY2ltYWwgcG9zaXRpb24gcmVwcmVzZW50cyBhIGxldmVsIG9mIHRoZSBvcHRncm91cCBoaWVyYXJjaHkuXG4gKiBAcHJvcGVydHkge21lbnVJdGVtW119IHN1Ym1lbnVcbiAqL1xuXG4vKiogQHR5cGVkZWYge3N0cmluZ3x2YWx1ZUl0ZW18c3VibWVudUl0ZW19IG1lbnVJdGVtXG4gKiBNYXkgYmUgb25lIG9mIHRocmVlIHBvc3NpYmxlIHR5cGVzIHRoYXQgc3BlY2lmeSBlaXRoZXIgYW4gYDxvcHRpb24+Li4uLjwvb3B0aW9uPmAgZWxlbWVudCBvciBhbiBgPG9wdGdyb3VwPi4uLi48L29wdGdyb3VwPmAgZWxlbWVudCBhcyBmb2xsb3dzOlxuICogKiBJZiBhIGBzdHJpbmdgLCBzcGVjaWZpZXMgdGhlIHRleHQgb2YgYW4gYDxvcHRpb24+Li4uLjwvb3B0aW9uPmAgZWxlbWVudCB3aXRoIG5vIGB2YWx1ZWAgYXR0cmlidXRlLiAoSW4gdGhlIGFic2VuY2Ugb2YgYSBgdmFsdWVgIGF0dHJpYnV0ZSwgdGhlIGB2YWx1ZWAgcHJvcGVydHkgb2YgdGhlIGVsZW1lbnQgZGVmYXVsdHMgdG8gdGhlIHRleHQuKVxuICogKiBJZiBzaGFwZWQgbGlrZSBhIHtAbGluayB2YWx1ZUl0ZW19IG9iamVjdCwgc3BlY2lmaWVzIGJvdGggdGhlIHRleHQgYW5kIHZhbHVlIG9mIGFuIGA8b3B0aW9uLi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqICogSWYgc2hhcGVkIGxpa2UgYSB7QGxpbmsgc3VibWVudUl0ZW19IG9iamVjdCAob3IgaXRzIGFsdGVybmF0ZSBhcnJheSBmb3JtKSwgc3BlY2lmaWVzIGFuIGA8b3B0Z3JvdXA+Li4uLjwvb3B0Z3JvdXA+YCBlbGVtZW50LlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgQnVpbGRzIGEgbmV3IG1lbnUgcHJlLXBvcHVsYXRlZCB3aXRoIGl0ZW1zIGFuZCBncm91cHMuXG4gKiBAZGVzYyBUaGlzIGZ1bmN0aW9uIGNyZWF0ZXMgYSBuZXcgcG9wLXVwIG1lbnUgKGEuay5hLiBcImRyb3AtZG93blwiKS4gVGhpcyBpcyBhIGA8c2VsZWN0Pi4uLjwvc2VsZWN0PmAgZWxlbWVudCwgcHJlLXBvcHVsYXRlZCB3aXRoIGl0ZW1zIChgPG9wdGlvbj4uLi48L29wdGlvbj5gIGVsZW1lbnRzKSBhbmQgZ3JvdXBzIChgPG9wdGdyb3VwPi4uLjwvb3B0Z3JvdXA+YCBlbGVtZW50cykuXG4gKiA+IEJvbnVzOiBUaGlzIGZ1bmN0aW9uIGFsc28gYnVpbGRzIGBpbnB1dCB0eXBlPXRleHRgIGVsZW1lbnRzLlxuICogPiBOT1RFOiBUaGlzIGZ1bmN0aW9uIGdlbmVyYXRlcyBPUFRHUk9VUCBlbGVtZW50cyBmb3Igc3VidHJlZXMuIEhvd2V2ZXIsIG5vdGUgdGhhdCBIVE1MNSBzcGVjaWZpZXMgdGhhdCBPUFRHUk9VUCBlbGVtbmVudHMgbWFkZSBub3QgbmVzdCEgVGhpcyBmdW5jdGlvbiBnZW5lcmF0ZXMgdGhlIG1hcmt1cCBmb3IgdGhlbSBidXQgdGhleSBhcmUgbm90IHJlbmRlcmVkIGJ5IG1vc3QgYnJvd3NlcnMsIG9yIG5vdCBjb21wbGV0ZWx5LiBUaGVyZWZvcmUsIGZvciBub3csIGRvIG5vdCBzcGVjaWZ5IG1vcmUgdGhhbiBvbmUgbGV2ZWwgc3VidHJlZXMuIEZ1dHVyZSB2ZXJzaW9ucyBvZiBIVE1MIG1heSBzdXBwb3J0IGl0LiBJIGFsc28gcGxhbiB0byBhZGQgaGVyZSBvcHRpb25zIHRvIGF2b2lkIE9QVEdST1VQUyBlbnRpcmVseSBlaXRoZXIgYnkgaW5kZW50aW5nIG9wdGlvbiB0ZXh0LCBvciBieSBjcmVhdGluZyBhbHRlcm5hdGUgRE9NIG5vZGVzIHVzaW5nIGA8bGk+YCBpbnN0ZWFkIG9mIGA8c2VsZWN0PmAsIG9yIGJvdGguXG4gKiBAbWVtYmVyT2YgcG9wTWVudVxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxzdHJpbmd9IGVsIC0gTXVzdCBiZSBvbmUgb2YgKGNhc2Utc2Vuc2l0aXZlKTpcbiAqICogdGV4dCBib3ggLSBhbiBgSFRNTElucHV0RWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdJTlBVVCdgIHRvIGNyZWF0ZSBhIG5ldyBvbmVcbiAqICogZHJvcC1kb3duIC0gYW4gYEhUTUxTZWxlY3RFbGVtZW50YCB0byB1c2UgYW4gZXhpc3RpbmcgZWxlbWVudCBvciBgJ1NFTEVDVCdgIHRvIGNyZWF0ZSBhIG5ldyBvbmVcbiAqICogc3VibWVudSAtIGFuIGBIVE1MT3B0R3JvdXBFbGVtZW50YCB0byB1c2UgYW4gZXhpc3RpbmcgZWxlbWVudCBvciBgJ09QVEdST1VQJ2AgdG8gY3JlYXRlIGEgbmV3IG9uZSAobWVhbnQgZm9yIGludGVybmFsIHVzZSBvbmx5KVxuICpcbiAqIEBwYXJhbSB7bWVudUl0ZW1bXX0gW21lbnVdIC0gSGllcmFyY2hpY2FsIGxpc3Qgb2Ygc3RyaW5ncyB0byBhZGQgYXMgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBvciBgPG9wdGdyb3VwPi4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMuIE9taXR0aW5nIGNyZWF0ZXMgYSB0ZXh0IGJveC5cbiAqXG4gKiBAcGFyYW0ge251bGx8c3RyaW5nfSBbb3B0aW9ucy5wcm9tcHQ9JyddIC0gQWRkcyBhbiBpbml0aWFsIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudCB0byB0aGUgZHJvcC1kb3duIHdpdGggdGhpcyB2YWx1ZSBpbiBwYXJlbnRoZXNlcyBhcyBpdHMgYHRleHRgOyBhbmQgZW1wdHkgc3RyaW5nIGFzIGl0cyBgdmFsdWVgLiBEZWZhdWx0IGlzIGVtcHR5IHN0cmluZywgd2hpY2ggY3JlYXRlcyBhIGJsYW5rIHByb21wdDsgYG51bGxgIHN1cHByZXNzZXMgcHJvbXB0IGFsdG9nZXRoZXIuXG4gKlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zb3J0XSAtIFdoZXRoZXIgdG8gYWxwaGEgc29ydCBvciBub3QuIElmIHRydXRoeSwgc29ydHMgZWFjaCBvcHRncm91cCBvbiBpdHMgYGxhYmVsYDsgYW5kIGVhY2ggc2VsZWN0IG9wdGlvbiBvbiBpdHMgdGV4dCAoaXRzIGBhbGlhc2AgaWYgZ2l2ZW47IG9yIGl0cyBgbmFtZWAgaWYgbm90KS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5ibGFja2xpc3RdIC0gT3B0aW9uYWwgbGlzdCBvZiBtZW51IGl0ZW0gbmFtZXMgdG8gYmUgaWdub3JlZC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcltdfSBbb3B0aW9ucy5icmVhZGNydW1ic10gLSBMaXN0IG9mIG9wdGlvbiBncm91cCBzZWN0aW9uIG51bWJlcnMgKHJvb3QgaXMgc2VjdGlvbiAwKS4gKEZvciBpbnRlcm5hbCB1c2UuKVxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYXBwZW5kPWZhbHNlXSAtIFdoZW4gYGVsYCBpcyBhbiBleGlzdGluZyBgPHNlbGVjdD5gIEVsZW1lbnQsIGdpdmluZyB0cnV0aHkgdmFsdWUgYWRkcyB0aGUgbmV3IGNoaWxkcmVuIHdpdGhvdXQgZmlyc3QgcmVtb3ZpbmcgZXhpc3RpbmcgY2hpbGRyZW4uXG4gKlxuICogQHJldHVybnMge0VsZW1lbnR9IEVpdGhlciBhIGA8c2VsZWN0PmAgb3IgYDxvcHRncm91cD5gIGVsZW1lbnQuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkKGVsLCBtZW51LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICB2YXIgcHJvbXB0ID0gb3B0aW9ucy5wcm9tcHQsXG4gICAgICAgIGJsYWNrbGlzdCA9IG9wdGlvbnMuYmxhY2tsaXN0LFxuICAgICAgICBzb3J0ID0gb3B0aW9ucy5zb3J0LFxuICAgICAgICBicmVhZGNydW1icyA9IG9wdGlvbnMuYnJlYWRjcnVtYnMgfHwgW10sXG4gICAgICAgIHBhdGggPSBicmVhZGNydW1icy5sZW5ndGggPyBicmVhZGNydW1icy5qb2luKCcuJykgKyAnLicgOiAnJyxcbiAgICAgICAgc3VidHJlZU5hbWUgPSBwb3BNZW51LnN1YnRyZWUsXG4gICAgICAgIGdyb3VwSW5kZXggPSAwLFxuICAgICAgICB0YWdOYW1lO1xuXG4gICAgaWYgKGVsIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgICB0YWdOYW1lID0gZWwudGFnTmFtZTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmFwcGVuZCkge1xuICAgICAgICAgICAgZWwuaW5uZXJIVE1MID0gJyc7IC8vIHJlbW92ZSBhbGwgPG9wdGlvbj4gYW5kIDxvcHRncm91cD4gZWxlbWVudHNcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRhZ05hbWUgPSBlbDtcbiAgICAgICAgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZ05hbWUpO1xuICAgIH1cblxuICAgIGlmIChtZW51KSB7XG4gICAgICAgIHZhciBhZGQsIG5ld09wdGlvbjtcbiAgICAgICAgaWYgKHRhZ05hbWUgPT09ICdTRUxFQ1QnKSB7XG4gICAgICAgICAgICBhZGQgPSBlbC5hZGQ7XG4gICAgICAgICAgICBpZiAocHJvbXB0KSB7XG4gICAgICAgICAgICAgICAgbmV3T3B0aW9uID0gbmV3IE9wdGlvbihwcm9tcHQsICcnKTtcbiAgICAgICAgICAgICAgICBuZXdPcHRpb24uaW5uZXJIVE1MICs9ICcmaGVsbGlwOyc7XG4gICAgICAgICAgICAgICAgZWwuYWRkKG5ld09wdGlvbik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb21wdCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsLmFkZChuZXcgT3B0aW9uKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWRkID0gZWwuYXBwZW5kQ2hpbGQ7XG4gICAgICAgICAgICBlbC5sYWJlbCA9IHByb21wdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzb3J0KSB7XG4gICAgICAgICAgICBtZW51ID0gbWVudS5zbGljZSgpLnNvcnQoaXRlbUNvbXBhcmF0b3IpOyAvLyBzb3J0ZWQgY2xvbmVcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbnUuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgICAgICAvLyBpZiBpdGVtIGlzIG9mIGZvcm0gYShiKSBhbmQgdGhlcmUgaXMgYW4gZnVuY3Rpb24gYSBpbiBvcHRpb25zLCB0aGVuIGl0ZW0gPSBvcHRpb25zLmEoYilcbiAgICAgICAgICAgIGlmIChvcHRpb25zICYmIHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhciBpbmRpcmVjdGlvbiA9IGl0ZW0ubWF0Y2goUkVHRVhQX0lORElSRUNUSU9OKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGEgPSBpbmRpcmVjdGlvblsxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGIgPSBpbmRpcmVjdGlvblsyXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGYgPSBvcHRpb25zW2FdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0gPSBmKGIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgJ2J1aWxkOiBFeHBlY3RlZCBvcHRpb25zLicgKyBhICsgJyB0byBiZSBhIGZ1bmN0aW9uLic7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzdWJ0cmVlID0gaXRlbVtzdWJ0cmVlTmFtZV0gfHwgaXRlbTtcbiAgICAgICAgICAgIGlmIChzdWJ0cmVlIGluc3RhbmNlb2YgQXJyYXkpIHtcblxuICAgICAgICAgICAgICAgIHZhciBncm91cE9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFkY3J1bWJzOiBicmVhZGNydW1icy5jb25jYXQoKytncm91cEluZGV4KSxcbiAgICAgICAgICAgICAgICAgICAgcHJvbXB0OiBpdGVtLmxhYmVsIHx8ICdHcm91cCAnICsgcGF0aCArIGdyb3VwSW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6IHNvcnQsXG4gICAgICAgICAgICAgICAgICAgIGJsYWNrbGlzdDogYmxhY2tsaXN0XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHZhciBvcHRncm91cCA9IGJ1aWxkKCdPUFRHUk9VUCcsIHN1YnRyZWUsIGdyb3VwT3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0Z3JvdXAuY2hpbGRFbGVtZW50Q291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZWwuYXBwZW5kQ2hpbGQob3B0Z3JvdXApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSAhPT0gJ29iamVjdCcpIHtcblxuICAgICAgICAgICAgICAgIGlmICghKGJsYWNrbGlzdCAmJiBibGFja2xpc3QuaW5kZXhPZihpdGVtKSA+PSAwKSkge1xuICAgICAgICAgICAgICAgICAgICBhZGQuY2FsbChlbCwgbmV3IE9wdGlvbihpdGVtKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFpdGVtLmhpZGRlbikge1xuXG4gICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBpdGVtLm5hbWUgfHwgaXRlbS5hbGlhcztcbiAgICAgICAgICAgICAgICBpZiAoIShibGFja2xpc3QgJiYgYmxhY2tsaXN0LmluZGV4T2YobmFtZSkgPj0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkLmNhbGwoZWwsIG5ldyBPcHRpb24oXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLmFsaWFzIHx8IGl0ZW0ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVcbiAgICAgICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLnR5cGUgPSAndGV4dCc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBpdGVtQ29tcGFyYXRvcihhLCBiKSB7XG4gICAgYSA9IGEuYWxpYXMgfHwgYS5uYW1lIHx8IGEubGFiZWwgfHwgYTtcbiAgICBiID0gYi5hbGlhcyB8fCBiLm5hbWUgfHwgYi5sYWJlbCB8fCBiO1xuICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBSZWN1cnNpdmVseSBzZWFyY2hlcyB0aGUgY29udGV4dCBhcnJheSBvZiBgbWVudUl0ZW1gcyBmb3IgYSBuYW1lZCBgaXRlbWAuXG4gKiBAbWVtYmVyT2YgcG9wTWVudVxuICogQHRoaXMgQXJyYXlcbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5rZXlzPVtwb3BNZW51LmRlZmF1bHRLZXldXSAtIFByb3BlcnRpZXMgdG8gc2VhcmNoIGVhY2ggbWVudUl0ZW0gd2hlbiBpdCBpcyBhbiBvYmplY3QuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNhc2VTZW5zaXRpdmU9ZmFsc2VdIC0gSWdub3JlIGNhc2Ugd2hpbGUgc2VhcmNoaW5nLlxuICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlIC0gVmFsdWUgdG8gc2VhcmNoIGZvci5cbiAqIEByZXR1cm5zIHt1bmRlZmluZWR8bWVudUl0ZW19IFRoZSBmb3VuZCBpdGVtIG9yIGB1bmRlZmluZWRgIGlmIG5vdCBmb3VuZC5cbiAqL1xuZnVuY3Rpb24gbG9va3VwKG9wdGlvbnMsIHZhbHVlKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdmFsdWUgPSBvcHRpb25zO1xuICAgICAgICBvcHRpb25zID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHZhciBzaGFsbG93LCBkZWVwLCBpdGVtLCBwcm9wLFxuICAgICAgICBrZXlzID0gb3B0aW9ucyAmJiBvcHRpb25zLmtleXMgfHwgW3BvcE1lbnUuZGVmYXVsdEtleV0sXG4gICAgICAgIGNhc2VTZW5zaXRpdmUgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FzZVNlbnNpdGl2ZTtcblxuICAgIHZhbHVlID0gdG9TdHJpbmcodmFsdWUsIGNhc2VTZW5zaXRpdmUpO1xuXG4gICAgc2hhbGxvdyA9IHRoaXMuZmluZChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHZhciBzdWJ0cmVlID0gaXRlbVtwb3BNZW51LnN1YnRyZWVdIHx8IGl0ZW07XG5cbiAgICAgICAgaWYgKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgcmV0dXJuIChkZWVwID0gbG9va3VwLmNhbGwoc3VidHJlZSwgb3B0aW9ucywgdmFsdWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgaXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiB0b1N0cmluZyhpdGVtLCBjYXNlU2Vuc2l0aXZlKSA9PT0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBwcm9wID0gaXRlbVtrZXlzW2ldXTtcbiAgICAgICAgICAgICAgICBpZiAocHJvcCAmJiB0b1N0cmluZyhwcm9wLCBjYXNlU2Vuc2l0aXZlKSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpdGVtID0gZGVlcCB8fCBzaGFsbG93O1xuXG4gICAgcmV0dXJuIGl0ZW0gJiYgKGl0ZW0ubmFtZSA/IGl0ZW0gOiB7IG5hbWU6IGl0ZW0gfSk7XG59XG5cbmZ1bmN0aW9uIHRvU3RyaW5nKHMsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICB2YXIgcmVzdWx0ID0gJyc7XG4gICAgaWYgKHMpIHtcbiAgICAgICAgcmVzdWx0ICs9IHM7IC8vIGNvbnZlcnQgcyB0byBzdHJpbmdcbiAgICAgICAgaWYgKCFjYXNlU2Vuc2l0aXZlKSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQudG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEBzdW1tYXJ5IFJlY3Vyc2l2ZWx5IHdhbGtzIHRoZSBjb250ZXh0IGFycmF5IG9mIGBtZW51SXRlbWBzIGFuZCBjYWxscyBgaXRlcmF0ZWVgIG9uIGVhY2ggaXRlbSB0aGVyZWluLlxuICogQGRlc2MgYGl0ZXJhdGVlYCBpcyBjYWxsZWQgd2l0aCBlYWNoIGl0ZW0gKHRlcm1pbmFsIG5vZGUpIGluIHRoZSBtZW51IHRyZWUgYW5kIGEgZmxhdCAwLWJhc2VkIGluZGV4LiBSZWN1cnNlcyBvbiBtZW1iZXIgd2l0aCBuYW1lIG9mIGBwb3BNZW51LnN1YnRyZWVgLlxuICpcbiAqIFRoZSBub2RlIHdpbGwgYWx3YXlzIGJlIGEge0BsaW5rIHZhbHVlSXRlbX0gb2JqZWN0OyB3aGVuIGEgYHN0cmluZ2AsIGl0IGlzIGJveGVkIGZvciB5b3UuXG4gKlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqXG4gKiBAdGhpcyBBcnJheVxuICpcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggaXRlbSBpbiB0aGUgbWVudSwgYGl0ZXJhdGVlYCBpcyBjYWxsZWQgd2l0aDpcbiAqICogdGhlIGB2YWx1ZUl0ZW1gIChpZiB0aGUgaXRlbSBpcyBhIHByaW1hdGl2ZSBzdHJpbmcsIGl0IGlzIHdyYXBwZWQgdXAgZm9yIHlvdSlcbiAqICogYSAwLWJhc2VkIGBvcmRpbmFsYFxuICpcbiAqIFRoZSBgaXRlcmF0ZWVgIHJldHVybiB2YWx1ZSBjYW4gYmUgdXNlZCB0byByZXBsYWNlIHRoZSBpdGVtLCBhcyBmb2xsb3dzOlxuICogKiBgdW5kZWZpbmVkYCAtIGRvIG5vdGhpbmdcbiAqICogYG51bGxgIC0gc3BsaWNlIG91dCB0aGUgaXRlbTsgcmVzdWx0aW5nIGVtcHR5IHN1Ym1lbnVzIGFyZSBhbHNvIHNwbGljZWQgb3V0IChzZWUgbm90ZSlcbiAqICogYW55dGhpbmcgZWxzZSAtIHJlcGxhY2UgdGhlIGl0ZW0gd2l0aCB0aGlzIHZhbHVlOyBpZiB2YWx1ZSBpcyBhIHN1YnRyZWUgKGkuZS4sIGFuIGFycmF5KSBgaXRlcmF0ZWVgIHdpbGwgdGhlbiBiZSBjYWxsZWQgdG8gd2FsayBpdCBhcyB3ZWxsIChzZWUgbm90ZSlcbiAqXG4gKiA+IE5vdGU6IFJldHVybmluZyBhbnl0aGluZyAob3RoZXIgdGhhbiBgdW5kZWZpbmVkYCkgZnJvbSBgaXRlcmF0ZWVgIHdpbGwgKGRlZXBseSkgbXV0YXRlIHRoZSBvcmlnaW5hbCBgbWVudWAgc28geW91IG1heSB3YW50IHRvIGNvcHkgaXQgZmlyc3QgKGRlZXBseSwgaW5jbHVkaW5nIGFsbCBsZXZlbHMgb2YgYXJyYXkgbmVzdGluZyBidXQgbm90IHRoZSB0ZXJtaW5hbCBub2RlIG9iamVjdHMpLlxuICpcbiAqIEByZXR1cm5zIHtudW1iZXJ9IE51bWJlciBvZiBpdGVtcyAodGVybWluYWwgbm9kZXMpIGluIHRoZSBtZW51IHRyZWUuXG4gKi9cbmZ1bmN0aW9uIHdhbGsoaXRlcmF0ZWUpIHtcbiAgICB2YXIgbWVudSA9IHRoaXMsXG4gICAgICAgIG9yZGluYWwgPSAwLFxuICAgICAgICBzdWJ0cmVlTmFtZSA9IHBvcE1lbnUuc3VidHJlZSxcbiAgICAgICAgaSwgaXRlbSwgc3VidHJlZSwgbmV3VmFsO1xuXG4gICAgZm9yIChpID0gbWVudS5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICBpdGVtID0gbWVudVtpXTtcbiAgICAgICAgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG5cbiAgICAgICAgaWYgKCEoc3VidHJlZSBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgc3VidHJlZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc3VidHJlZSkge1xuICAgICAgICAgICAgbmV3VmFsID0gaXRlcmF0ZWUoaXRlbS5uYW1lID8gaXRlbSA6IHsgbmFtZTogaXRlbSB9LCBvcmRpbmFsKTtcbiAgICAgICAgICAgIG9yZGluYWwgKz0gMTtcblxuICAgICAgICAgICAgaWYgKG5ld1ZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1ZhbCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBtZW51LnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgb3JkaW5hbCAtPSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbnVbaV0gPSBpdGVtID0gbmV3VmFsO1xuICAgICAgICAgICAgICAgICAgICBzdWJ0cmVlID0gaXRlbVtzdWJ0cmVlTmFtZV0gfHwgaXRlbTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoc3VidHJlZSBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VidHJlZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdWJ0cmVlKSB7XG4gICAgICAgICAgICBvcmRpbmFsICs9IHdhbGsuY2FsbChzdWJ0cmVlLCBpdGVyYXRlZSk7XG4gICAgICAgICAgICBpZiAoc3VidHJlZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBtZW51LnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBvcmRpbmFsIC09IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb3JkaW5hbDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBGb3JtYXQgaXRlbSBuYW1lIHdpdGggaXQncyBhbGlhcyB3aGVuIGF2YWlsYWJsZS5cbiAqIEBtZW1iZXJPZiBwb3BNZW51XG4gKiBAcGFyYW0ge3N0cmluZ3x2YWx1ZUl0ZW19IGl0ZW1cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBmb3JtYXR0ZWQgbmFtZSBhbmQgYWxpYXMuXG4gKi9cbmZ1bmN0aW9uIGZvcm1hdEl0ZW0oaXRlbSkge1xuICAgIHZhciByZXN1bHQgPSBpdGVtLm5hbWUgfHwgaXRlbTtcbiAgICBpZiAoaXRlbS5hbGlhcykge1xuICAgICAgICByZXN1bHQgPSAnXCInICsgaXRlbS5hbGlhcyArICdcIiAoJyArIHJlc3VsdCArICcpJztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG5mdW5jdGlvbiBpc0dyb3VwUHJveHkocykge1xuICAgIHJldHVybiBSRUdFWFBfSU5ESVJFQ1RJT04udGVzdChzKTtcbn1cblxuLyoqXG4gKiBAbmFtZXNwYWNlXG4gKi9cbnZhciBwb3BNZW51ID0ge1xuICAgIGJ1aWxkOiBidWlsZCxcbiAgICB3YWxrOiB3YWxrLFxuICAgIGxvb2t1cDogbG9va3VwLFxuICAgIGZvcm1hdEl0ZW06IGZvcm1hdEl0ZW0sXG4gICAgaXNHcm91cFByb3h5OiBpc0dyb3VwUHJveHksXG4gICAgc3VidHJlZTogJ3N1Ym1lbnUnLFxuICAgIGRlZmF1bHRLZXk6ICduYW1lJ1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBwb3BNZW51O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgLy8gYSByZWdleCBzZWFyY2ggcGF0dGVybiB0aGF0IG1hdGNoZXMgYWxsIHRoZSByZXNlcnZlZCBjaGFycyBvZiBhIHJlZ2V4IHNlYXJjaCBwYXR0ZXJuXG4gICAgcmVzZXJ2ZWQgPSAvKFtcXC5cXFxcXFwrXFwqXFw/XFxeXFwkXFwoXFwpXFx7XFx9XFw9XFwhXFw8XFw+XFx8XFw6XFxbXFxdXSkvZyxcblxuICAgIC8vIHJlZ2V4IHdpbGRjYXJkIHNlYXJjaCBwYXR0ZXJuc1xuICAgIFJFR0VYUF9XSUxEQ0FSRCA9ICcuKicsXG4gICAgUkVHRVhQX1dJTERDSEFSID0gJy4nLFxuICAgIFJFR0VYUF9XSUxEQ0FSRF9NQVRDSEVSID0gJygnICsgUkVHRVhQX1dJTERDQVJEICsgJyknLFxuXG4gICAgLy8gTElLRSBzZWFyY2ggcGF0dGVybnNcbiAgICBMSUtFX1dJTERDSEFSID0gJ18nLFxuICAgIExJS0VfV0lMRENBUkQgPSAnJScsXG5cbiAgICAvLyByZWdleCBzZWFyY2ggcGF0dGVybnMgdGhhdCBtYXRjaCBMSUtFIHNlYXJjaCBwYXR0ZXJuc1xuICAgIFJFR0VYUF9MSUtFX1BBVFRFUk5fTUFUQ0hFUiA9IG5ldyBSZWdFeHAoJygnICsgW1xuICAgICAgICBMSUtFX1dJTERDSEFSLFxuICAgICAgICBMSUtFX1dJTERDQVJELFxuICAgICAgICAnXFxcXFtcXFxcXj9bXi1cXFxcXV0rXScsIC8vIG1hdGNoZXMgYSBMSUtFIHNldCAoc2FtZSBzeW50YXggYXMgYSBSZWdFeHAgc2V0KVxuICAgICAgICAnXFxcXFtcXFxcXj9bXi1cXFxcXV1cXFxcLVteXFxcXF1dXScgLy8gbWF0Y2hlcyBhIExJS0UgcmFuZ2UgKHNhbWUgc3ludGF4IGFzIGEgUmVnRXhwIHJhbmdlKVxuICAgIF0uam9pbignfCcpICsgJyknLCAnZycpO1xuXG5mdW5jdGlvbiByZWdFeHBMSUtFKHBhdHRlcm4sIGlnbm9yZUNhc2UpIHtcbiAgICB2YXIgaSwgcGFydHM7XG5cbiAgICAvLyBGaW5kIGFsbCBMSUtFIHBhdHRlcm5zXG4gICAgcGFydHMgPSBwYXR0ZXJuLm1hdGNoKFJFR0VYUF9MSUtFX1BBVFRFUk5fTUFUQ0hFUik7XG5cbiAgICBpZiAocGFydHMpIHtcbiAgICAgICAgLy8gVHJhbnNsYXRlIGZvdW5kIExJS0UgcGF0dGVybnMgdG8gcmVnZXggcGF0dGVybnMsIGVzY2FwZWQgaW50ZXJ2ZW5pbmcgbm9uLXBhdHRlcm5zLCBhbmQgaW50ZXJsZWF2ZSB0aGUgdHdvXG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAvLyBFc2NhcGUgbGVmdCBicmFja2V0cyAodW5wYWlyZWQgcmlnaHQgYnJhY2tldHMgYXJlIE9LKVxuICAgICAgICAgICAgaWYgKHBhcnRzW2ldWzBdID09PSAnWycpIHtcbiAgICAgICAgICAgICAgICBwYXJ0c1tpXSA9IHJlZ0V4cExJS0UucmVzZXJ2ZShwYXJ0c1tpXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgZWFjaCBmb3VuZCBwYXR0ZXJuIG1hdGNoYWJsZSBieSBlbmNsb3NpbmcgaW4gcGFyZW50aGVzZXNcbiAgICAgICAgICAgIHBhcnRzW2ldID0gJygnICsgcGFydHNbaV0gKyAnKSc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNYXRjaCB0aGVzZSBwcmVjaXNlIHBhdHRlcm5zIGFnYWluIHdpdGggdGhlaXIgaW50ZXJ2ZW5pbmcgbm9uLXBhdHRlcm5zIChpLmUuLCB0ZXh0KVxuICAgICAgICBwYXJ0cyA9IHBhdHRlcm4ubWF0Y2gobmV3IFJlZ0V4cChcbiAgICAgICAgICAgIFJFR0VYUF9XSUxEQ0FSRF9NQVRDSEVSICtcbiAgICAgICAgICAgIHBhcnRzLmpvaW4oUkVHRVhQX1dJTERDQVJEX01BVENIRVIpICArXG4gICAgICAgICAgICBSRUdFWFBfV0lMRENBUkRfTUFUQ0hFUlxuICAgICAgICApKTtcblxuICAgICAgICAvLyBEaXNjYXJkIGZpcnN0IG1hdGNoIG9mIG5vbi1nbG9iYWwgc2VhcmNoICh3aGljaCBpcyB0aGUgd2hvbGUgc3RyaW5nKVxuICAgICAgICBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgICAgIC8vIEZvciBlYWNoIHJlLWZvdW5kIHBhdHRlcm4gcGFydCwgdHJhbnNsYXRlICUgYW5kIF8gdG8gcmVnZXggZXF1aXZhbGVudFxuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgcGFydHMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgICAgIHZhciBwYXJ0ID0gcGFydHNbaV07XG4gICAgICAgICAgICBzd2l0Y2ggKHBhcnQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIExJS0VfV0lMRENBUkQ6IHBhcnQgPSBSRUdFWFBfV0lMRENBUkQ7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTElLRV9XSUxEQ0hBUjogcGFydCA9IFJFR0VYUF9XSUxEQ0hBUjsgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdmFyIGogPSBwYXJ0WzFdID09PSAnXicgPyAyIDogMTtcbiAgICAgICAgICAgICAgICAgICAgcGFydCA9ICdbJyArIHJlZ0V4cExJS0UucmVzZXJ2ZShwYXJ0LnN1YnN0cihqLCBwYXJ0Lmxlbmd0aCAtIChqICsgMSkpKSArICddJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhcnRzW2ldID0gcGFydDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnRzID0gW3BhdHRlcm5dO1xuICAgIH1cblxuICAgIC8vIEZvciBlYWNoIHN1cnJvdW5kaW5nIHRleHQgcGFydCwgZXNjYXBlIHJlc2VydmVkIHJlZ2V4IGNoYXJzXG4gICAgZm9yIChpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIHBhcnRzW2ldID0gcmVnRXhwTElLRS5yZXNlcnZlKHBhcnRzW2ldKTtcbiAgICB9XG5cbiAgICAvLyBKb2luIGFsbCB0aGUgaW50ZXJsZWF2ZWQgcGFydHNcbiAgICBwYXJ0cyA9IHBhcnRzLmpvaW4oJycpO1xuXG4gICAgLy8gT3B0aW1pemUgb3IgYW5jaG9yIHRoZSBwYXR0ZXJuIGF0IGVhY2ggZW5kIGFzIG5lZWRlZFxuICAgIGlmIChwYXJ0cy5zdWJzdHIoMCwgMikgPT09IFJFR0VYUF9XSUxEQ0FSRCkgeyBwYXJ0cyA9IHBhcnRzLnN1YnN0cigyKTsgfSBlbHNlIHsgcGFydHMgPSAnXicgKyBwYXJ0czsgfVxuICAgIGlmIChwYXJ0cy5zdWJzdHIoLTIsIDIpID09PSBSRUdFWFBfV0lMRENBUkQpIHsgcGFydHMgPSBwYXJ0cy5zdWJzdHIoMCwgcGFydHMubGVuZ3RoIC0gMik7IH0gZWxzZSB7IHBhcnRzICs9ICckJzsgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBuZXcgcmVnZXhcbiAgICByZXR1cm4gbmV3IFJlZ0V4cChwYXJ0cywgaWdub3JlQ2FzZSA/ICdpJyA6IHVuZGVmaW5lZCk7XG59XG5cbnJlZ0V4cExJS0UucmVzZXJ2ZSA9IGZ1bmN0aW9uIChzKSB7XG4gICAgcmV0dXJuIHMucmVwbGFjZShyZXNlcnZlZCwgJ1xcXFwkMScpO1xufTtcblxudmFyIGNhY2hlLCBzaXplO1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlbGV0ZSBhIHBhdHRlcm4gZnJvbSB0aGUgY2FjaGU7IG9yIGNsZWFyIHRoZSB3aG9sZSBjYWNoZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbcGF0dGVybl0gLSBUaGUgTElLRSBwYXR0ZXJuIHRvIHJlbW92ZSBmcm9tIHRoZSBjYWNoZS4gRmFpbHMgc2lsZW50bHkgaWYgbm90IGZvdW5kIGluIHRoZSBjYWNoZS4gSWYgcGF0dGVybiBvbWl0dGVkLCBjbGVhcnMgd2hvbGUgY2FjaGUuXG4gKi9cbihyZWdFeHBMSUtFLmNsZWFyQ2FjaGUgPSBmdW5jdGlvbiAocGF0dGVybikge1xuICAgIGlmICghcGF0dGVybikge1xuICAgICAgICBjYWNoZSA9IHt9O1xuICAgICAgICBzaXplID0gMDtcbiAgICB9IGVsc2UgaWYgKGNhY2hlW3BhdHRlcm5dKSB7XG4gICAgICAgIGRlbGV0ZSBjYWNoZVtwYXR0ZXJuXTtcbiAgICAgICAgc2l6ZS0tO1xuICAgIH1cbiAgICByZXR1cm4gc2l6ZTtcbn0pKCk7IC8vIGluaXQgdGhlIGNhY2hlXG5cbnJlZ0V4cExJS0UuZ2V0Q2FjaGVTaXplID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gc2l6ZTsgfTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDYWNoZWQgdmVyc2lvbiBvZiBgcmVnRXhwTElLRSgpYC5cbiAqIEBkZXNjIENhY2hlZCBlbnRyaWVzIGFyZSBzdWJqZWN0IHRvIGdhcmJhZ2UgY29sbGVjdGlvbiBpZiBga2VlcGAgaXMgYHVuZGVmaW5lZGAgb3IgYGZhbHNlYCBvbiBpbnNlcnRpb24gb3IgYGZhbHNlYCBvbiBtb3N0IHJlY2VudCByZWZlcmVuY2UuIEdhcmJhZ2UgY29sbGVjdGlvbiB3aWxsIG9jY3VyIGlmZiBgcmVnRXhwTElLRS5jYWNoZU1heGAgaXMgZGVmaW5lZCBhbmQgaXQgZXF1YWxzIHRoZSBudW1iZXIgb2YgY2FjaGVkIHBhdHRlcm5zLiBUaGUgZ2FyYmFnZSBjb2xsZWN0b3Igc29ydHMgdGhlIHBhdHRlcm5zIGJhc2VkIG9uIG1vc3QgcmVjZW50IHJlZmVyZW5jZTsgdGhlIG9sZGVzdCAxMCUgb2YgdGhlIGVudHJpZXMgYXJlIGRlbGV0ZWQuIEFsdGVybmF0aXZlbHksIHlvdSBjYW4gbWFuYWdlIHRoZSBjYWNoZSB5b3Vyc2VsZiB0byBhIGxpbWl0ZWQgZXh0ZW50IChzZWUge0BsaW5rIHJlZ2VFeHBMSUtFLmNsZWFyQ2FjaGV8Y2xlYXJDYWNoZX0pLlxuICogQHBhcmFtIHBhdHRlcm4gLSB0aGUgTElLRSBwYXR0ZXJuICh0byBiZSkgY29udmVydGVkIHRvIGEgUmVnRXhwXG4gKiBAcGFyYW0gW2tlZXBdIC0gSWYgZ2l2ZW4sIGNoYW5nZXMgdGhlIGtlZXAgc3RhdHVzIGZvciB0aGlzIHBhdHRlcm4gYXMgZm9sbG93czpcbiAqICogYHRydWVgIHBlcm1hbmVudGx5IGNhY2hlcyB0aGUgcGF0dGVybiAobm90IHN1YmplY3QgdG8gZ2FyYmFnZSBjb2xsZWN0aW9uKSB1bnRpbCBgZmFsc2VgIGlzIGdpdmVuIG9uIGEgc3Vic2VxdWVudCBjYWxsXG4gKiAqIGBmYWxzZWAgYWxsb3dzIGdhcmJhZ2UgY29sbGVjdGlvbiBvbiB0aGUgY2FjaGVkIHBhdHRlcm5cbiAqICogYHVuZGVmaW5lZGAgbm8gY2hhbmdlIHRvIGtlZXAgc3RhdHVzXG4gKiBAcmV0dXJucyB7UmVnRXhwfVxuICovXG5yZWdFeHBMSUtFLmNhY2hlZCA9IGZ1bmN0aW9uIChrZWVwLCBwYXR0ZXJuLCBpZ25vcmVDYXNlKSB7XG4gICAgaWYgKHR5cGVvZiBrZWVwID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZ25vcmVDYXNlID0gcGF0dGVybjtcbiAgICAgICAgcGF0dGVybiA9IGtlZXA7XG4gICAgICAgIGtlZXAgPSBmYWxzZTtcbiAgICB9XG4gICAgdmFyIHBhdHRlcm5BbmRDYXNlID0gcGF0dGVybiArIChpZ25vcmVDYXNlID8gJ2knIDogJ2MnKSxcbiAgICAgICAgaXRlbSA9IGNhY2hlW3BhdHRlcm5BbmRDYXNlXTtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgICBpdGVtLndoZW4gPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgICAgaWYgKGtlZXAgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaXRlbS5rZWVwID0ga2VlcDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChzaXplID09PSByZWdFeHBMSUtFLmNhY2hlTWF4KSB7XG4gICAgICAgICAgICB2YXIgYWdlID0gW10sIGFnZXMgPSAwLCBrZXksIGk7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBjYWNoZSkge1xuICAgICAgICAgICAgICAgIGl0ZW0gPSBjYWNoZVtrZXldO1xuICAgICAgICAgICAgICAgIGlmICghaXRlbS5rZWVwKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBhZ2VzOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLndoZW4gPCBhZ2VbaV0uaXRlbS53aGVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYWdlLnNwbGljZShpLCAwLCB7IGtleToga2V5LCBpdGVtOiBpdGVtIH0pO1xuICAgICAgICAgICAgICAgICAgICBhZ2VzKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFhZ2UubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlZ0V4cExJS0UocGF0dGVybiwgaWdub3JlQ2FzZSk7IC8vIGNhY2hlIGlzIGZ1bGwhXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpID0gTWF0aC5jZWlsKGFnZS5sZW5ndGggLyAxMCk7IC8vIHdpbGwgYWx3YXlzIGJlIGF0IGxlYXN0IDFcbiAgICAgICAgICAgIHNpemUgLT0gaTtcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgY2FjaGVbYWdlW2ldLmtleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaXRlbSA9IGNhY2hlW3BhdHRlcm5BbmRDYXNlXSA9IHtcbiAgICAgICAgICAgIHJlZ2V4OiByZWdFeHBMSUtFKHBhdHRlcm4sIGlnbm9yZUNhc2UpLFxuICAgICAgICAgICAga2VlcDoga2VlcCxcbiAgICAgICAgICAgIHdoZW46IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgIH07XG4gICAgICAgIHNpemUrKztcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW0ucmVnZXg7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlZ0V4cExJS0U7XG4iLCIvLyB0ZW1wbGV4IG5vZGUgbW9kdWxlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L3RlbXBsZXhcblxuLyogZXNsaW50LWVudiBub2RlICovXG5cbi8qKlxuICogTWVyZ2VzIHZhbHVlcyBvZiBleGVjdXRpb24gY29udGV4dCBwcm9wZXJ0aWVzIG5hbWVkIGluIHRlbXBsYXRlIGJ5IHtwcm9wMX0sXG4gKiB7cHJvcDJ9LCBldGMuLCBvciBhbnkgamF2YXNjcmlwdCBleHByZXNzaW9uIGluY29ycG9yYXRpbmcgc3VjaCBwcm9wIG5hbWVzLlxuICogVGhlIGNvbnRleHQgYWx3YXlzIGluY2x1ZGVzIHRoZSBnbG9iYWwgb2JqZWN0LiBJbiBhZGRpdGlvbiB5b3UgY2FuIHNwZWNpZnkgYSBzaW5nbGVcbiAqIGNvbnRleHQgb3IgYW4gYXJyYXkgb2YgY29udGV4dHMgdG8gc2VhcmNoIChpbiB0aGUgb3JkZXIgZ2l2ZW4pIGJlZm9yZSBmaW5hbGx5XG4gKiBzZWFyY2hpbmcgdGhlIGdsb2JhbCBjb250ZXh0LlxuICpcbiAqIE1lcmdlIGV4cHJlc3Npb25zIGNvbnNpc3Rpbmcgb2Ygc2ltcGxlIG51bWVyaWMgdGVybXMsIHN1Y2ggYXMgezB9LCB7MX0sIGV0Yy4sIGRlcmVmXG4gKiB0aGUgZmlyc3QgY29udGV4dCBnaXZlbiwgd2hpY2ggaXMgYXNzdW1lZCB0byBiZSBhbiBhcnJheS4gQXMgYSBjb252ZW5pZW5jZSBmZWF0dXJlLFxuICogaWYgYWRkaXRpb25hbCBhcmdzIGFyZSBnaXZlbiBhZnRlciBgdGVtcGxhdGVgLCBgYXJndW1lbnRzYCBpcyB1bnNoaWZ0ZWQgb250byB0aGUgY29udGV4dFxuICogYXJyYXksIHRodXMgbWFraW5nIGZpcnN0IGFkZGl0aW9uYWwgYXJnIGF2YWlsYWJsZSBhcyB7MX0sIHNlY29uZCBhcyB7Mn0sIGV0Yy4sIGFzIGluXG4gKiBgdGVtcGxleCgnSGVsbG8sIHsxfSEnLCAnV29ybGQnKWAuICh7MH0gaXMgdGhlIHRlbXBsYXRlIHNvIGNvbnNpZGVyIHRoaXMgdG8gYmUgMS1iYXNlZC4pXG4gKlxuICogSWYgeW91IHByZWZlciBzb21ldGhpbmcgb3RoZXIgdGhhbiBicmFjZXMsIHJlZGVmaW5lIGB0ZW1wbGV4LnJlZ2V4cGAuXG4gKlxuICogU2VlIHRlc3RzIGZvciBleGFtcGxlcy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVcbiAqIEBwYXJhbSB7Li4uc3RyaW5nfSBbYXJnc11cbiAqL1xuZnVuY3Rpb24gdGVtcGxleCh0ZW1wbGF0ZSkge1xuICAgIHZhciBjb250ZXh0cyA9IHRoaXMgaW5zdGFuY2VvZiBBcnJheSA/IHRoaXMgOiBbdGhpc107XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7IGNvbnRleHRzLnVuc2hpZnQoYXJndW1lbnRzKTsgfVxuICAgIHJldHVybiB0ZW1wbGF0ZS5yZXBsYWNlKHRlbXBsZXgucmVnZXhwLCB0ZW1wbGV4Lm1lcmdlci5iaW5kKGNvbnRleHRzKSk7XG59XG5cbnRlbXBsZXgucmVnZXhwID0gL1xceyguKj8pXFx9L2c7XG5cbnRlbXBsZXgud2l0aCA9IGZ1bmN0aW9uIChpLCBzKSB7XG4gICAgcmV0dXJuICd3aXRoKHRoaXNbJyArIGkgKyAnXSl7JyArIHMgKyAnfSc7XG59O1xuXG50ZW1wbGV4LmNhY2hlID0gW107XG5cbnRlbXBsZXguZGVyZWYgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKCEodGhpcy5sZW5ndGggaW4gdGVtcGxleC5jYWNoZSkpIHtcbiAgICAgICAgdmFyIGNvZGUgPSAncmV0dXJuIGV2YWwoZXhwciknO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29kZSA9IHRlbXBsZXgud2l0aChpLCBjb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRlbXBsZXguY2FjaGVbdGhpcy5sZW5ndGhdID0gZXZhbCgnKGZ1bmN0aW9uKGV4cHIpeycgKyBjb2RlICsgJ30pJyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tZXZhbFxuICAgIH1cbiAgICByZXR1cm4gdGVtcGxleC5jYWNoZVt0aGlzLmxlbmd0aF0uY2FsbCh0aGlzLCBrZXkpO1xufTtcblxudGVtcGxleC5tZXJnZXIgPSBmdW5jdGlvbiAobWF0Y2gsIGtleSkge1xuICAgIC8vIEFkdmFuY2VkIGZlYXR1cmVzOiBDb250ZXh0IGNhbiBiZSBhIGxpc3Qgb2YgY29udGV4dHMgd2hpY2ggYXJlIHNlYXJjaGVkIGluIG9yZGVyLlxuICAgIHZhciByZXBsYWNlbWVudDtcblxuICAgIHRyeSB7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gaXNOYU4oa2V5KSA/IHRlbXBsZXguZGVyZWYuY2FsbCh0aGlzLCBrZXkpIDogdGhpc1swXVtrZXldO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVwbGFjZW1lbnQgPSAneycgKyBrZXkgKyAnfSc7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcGxhY2VtZW50O1xufTtcblxuLy8gdGhpcyBpbnRlcmZhY2UgY29uc2lzdHMgc29sZWx5IG9mIHRoZSB0ZW1wbGV4IGZ1bmN0aW9uIChhbmQgaXQncyBwcm9wZXJ0aWVzKVxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGV4O1xuIiwiLy8gQ3JlYXRlZCBieSBKb25hdGhhbiBFaXRlbiBvbiAxLzcvMTYuXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBWZXJ5IGZhc3QgYXJyYXkgdGVzdC5cbiAqIEZvciBjcm9zcy1mcmFtZSBzY3JpcHRpbmc7IHVzZSBgY3Jvc3NGcmFtZXNJc0FycmF5YCBpbnN0ZWFkLlxuICogQHBhcmFtIHsqfSBhcnIgLSBUaGUgb2JqZWN0IHRvIHRlc3QuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xudW5zdHJ1bmdpZnkuaXNBcnJheSA9IGZ1bmN0aW9uKGFycikgeyByZXR1cm4gYXJyLmNvbnN0cnVjdG9yID09PSBBcnJheTsgfTtcblxuLyoqXG4gKiBAc3VtbWFyeSBXYWxrIGEgaGllcmFyY2hpY2FsIG9iamVjdCBhcyBKU09OLnN0cmluZ2lmeSBkb2VzIGJ1dCB3aXRob3V0IHNlcmlhbGl6aW5nLlxuICpcbiAqIEBkZXNjIFVzYWdlOlxuICogKiB2YXIgbXlEaXN0aWxsZWRPYmplY3QgPSB1bnN0cnVuZ2lmeS5jYWxsKG15T2JqZWN0KTtcbiAqICogdmFyIG15RGlzdGlsbGVkT2JqZWN0ID0gbXlBcGkuZ2V0U3RhdGUoKTsgLy8gd2hlcmUgbXlBcGkucHJvdG90eXBlLmdldFN0YXRlID0gdW5zdHJ1bmdpZnlcbiAqXG4gKiBSZXN1bHQgZXF1aXZhbGVudCB0byBgSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzKSlgLlxuICpcbiAqID4gRG8gbm90IHVzZSB0aGlzIGZ1bmN0aW9uIHRvIGdldCBhIEpTT04gc3RyaW5nOyB1c2UgYEpTT04uc3RyaW5naWZ5KHRoaXMpYCBpbnN0ZWFkLlxuICpcbiAqIEB0aGlzIHsqfG9iamVjdHwqW119IC0gT2JqZWN0IHRvIHdhbGs7IHR5cGljYWxseSBhbiBvYmplY3Qgb3IgYXJyYXkuXG4gKlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5udWxsRWxlbWVudHM9PWZhbHNlXSAtIFByZXNlcnZlIHVuZGVmaW5lZCBhcnJheSBlbGVtZW50cyBhcyBgbnVsbGBzLlxuICogVXNlIHRoaXMgd2hlbiBwcmVjaXNlIGluZGV4IG1hdHRlcnMgKG5vdCBtZXJlbHkgdGhlIG9yZGVyIG9mIHRoZSBlbGVtZW50cykuXG4gKlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5udWxsUHJvcGVydGllcz09ZmFsc2VdIC0gUHJlc2VydmUgdW5kZWZpbmVkIG9iamVjdCBwcm9wZXJ0aWVzIGFzIGBudWxsYHMuXG4gKlxuICogQHJldHVybnMge29iamVjdH0gLSBEaXN0aWxsZWQgb2JqZWN0LlxuICovXG5mdW5jdGlvbiB1bnN0cnVuZ2lmeShvcHRpb25zKSB7XG4gICAgdmFyIGNsb25lLCBwcmVzZXJ2ZSxcbiAgICAgICAgb2JqZWN0ID0gKHR5cGVvZiB0aGlzLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJykgPyB0aGlzLnRvSlNPTigpIDogdGhpcztcblxuICAgIGlmICh1bnN0cnVuZ2lmeS5pc0FycmF5KG9iamVjdCkpIHtcbiAgICAgICAgY2xvbmUgPSBbXTtcbiAgICAgICAgcHJlc2VydmUgPSBvcHRpb25zICYmIG9wdGlvbnMubnVsbEVsZW1lbnRzO1xuICAgICAgICBvYmplY3QuZm9yRWFjaChmdW5jdGlvbihvYmopIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHVuc3RydW5naWZ5LmNhbGwob2JqKTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xvbmUucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByZXNlcnZlKSB7XG4gICAgICAgICAgICAgICAgY2xvbmUucHVzaChudWxsKTsgLy8gdW5kZWZpbmVkIG5vdCBhIHZhbGlkIEpTT04gdmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSBlbHNlICBpZiAodHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgY2xvbmUgPSB7fTtcbiAgICAgICAgcHJlc2VydmUgPSBvcHRpb25zICYmIG9wdGlvbnMubnVsbFByb3BlcnRpZXM7XG4gICAgICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IG9iamVjdFtrZXldO1xuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHVuc3RydW5naWZ5LmNhbGwob2JqZWN0W2tleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbG9uZVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByZXNlcnZlKSB7XG4gICAgICAgICAgICAgICAgY2xvbmVba2V5XSA9IG51bGw7IC8vIHVuZGVmaW5lZCBub3QgYSB2YWxpZCBKU09OIHZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNsb25lID0gb2JqZWN0O1xuICAgIH1cblxuICAgIHJldHVybiBjbG9uZTtcbn1cblxuLyoqXG4gKiBWZXJ5IHNsb3cgYXJyYXkgdGVzdC4gU3VpdGFibGUgZm9yIGNyb3NzLWZyYW1lIHNjcmlwdGluZy5cbiAqXG4gKiBTdWdnZXN0aW9uOiBJZiB5b3UgbmVlZCB0aGlzIGFuZCBoYXZlIGpRdWVyeSBsb2FkZWQsIHVzZSBgalF1ZXJ5LmlzQXJyYXlgIGluc3RlYWQgd2hpY2ggaXMgcmVhc29uYWJseSBmYXN0LlxuICpcbiAqIEBwYXJhbSB7Kn0gYXJyIC0gVGhlIG9iamVjdCB0byB0ZXN0LlxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnVuc3RydW5naWZ5LmNyb3NzRnJhbWVzSXNBcnJheSA9IGZ1bmN0aW9uKGFycikgeyByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09PSBhcnJTdHJpbmc7IH07IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZywgYXJyU3RyaW5nID0gJ1tvYmplY3QgQXJyYXldJztcblxubW9kdWxlLmV4cG9ydHMgPSB1bnN0cnVuZ2lmeTtcbiJdfQ==
