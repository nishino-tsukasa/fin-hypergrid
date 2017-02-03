(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var DefaultFilter = require('./js/DefaultFilter');
var ColumnSchemaFactory = require('./js/ColumnSchemaFactory');
var FilterSubgrid = require('./js/FilterSubgrid');

/**
 * @param {Hypergrid} grid
 * @param {object} [targets] - Hash of mixin targets. These are typically prototype objects. If not given or any targets are missing, defaults to current grid's various prototypes.
 * @constructor
 */
function Hyperfilter(grid, targets) {
    this.grid = grid;
    this.install(targets);
}

Hyperfilter.prototype = {
    constructor: Hyperfilter.prototype.constructor,

    name: 'Hyperfilter',

    install: function(targets) {
        targets = targets || {};

        var behavior = this.grid.behavior,
            BehaviorPrototype = targets.BehaviorPrototype || targets.Behavior && targets.Behavior.prototype,
            DataModelPrototype = targets.DataModelPrototype || targets.DataModel && targets.DataModel.prototype || Object.getPrototypeOf(behavior.dataModel),
            subgrids = behavior.subgrids;

        if (!BehaviorPrototype) {
            BehaviorPrototype = behavior;
            do {
                BehaviorPrototype = Object.getPrototypeOf(BehaviorPrototype);
            }
                while (BehaviorPrototype.$$CLASS_NAME !== 'Behavior');
        }

        // Register in case a subgrid list is included in state object of a subsequent grid instantiation
        behavior.dataModels.FilterSubgrid = FilterSubgrid;

        if (!subgrids.lookup.filter) {
            var index = subgrids.indexOf(subgrids.lookup.header) + 1,
                subgrid = behavior.createSubgrid(FilterSubgrid);
            subgrids.splice(index, 0, subgrid);
        }

        Object.getPrototypeOf(this.grid).mixIn(require('./mix-ins/grid'));

        BehaviorPrototype.mixIn(require('./mix-ins/behavior'));
        DataModelPrototype.mixIn(require('./mix-ins/dataModel'));
    },

    /**
     * May be adjusted before calling {@link HyperFilter#create|create}.
     * @default
     * @type {boolean}
     */
    caseSensitiveData: true,

    /**
     * May be adjusted before calling {@link HyperFilter#create|create}.
     * @default
     * @type {boolean}
     */
    caseSensitiveColumnNames: true,

    /**
     * May be adjusted before calling {@link HyperFilter#create|create}.
     * @default
     * @type {boolean}
     */
    resolveAliases: false,

    /**
     * May be adjusted before calling {@link HyperFilter#create|create}.
     * @default
     * @type {string}
     */
    defaultColumnFilterOperator: '', // blank means use default ('=')

    /**
     * @param {function|menuItem[]} [schema] - If omitted, derives a schema. If a function, derives a schema and calls it with for possible modifications
     */
    create: function(schema) {
        if (!schema) {
            schema = new ColumnSchemaFactory(this.grid.behavior.allColumns).schema;
        } else if (typeof schema === 'function') {
            var factory = new ColumnSchemaFactory(this.grid.behavior.allColumns);
            schema.call(factory);
            schema = factory.schema;
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

},{"./js/ColumnSchemaFactory":2,"./js/DefaultFilter":3,"./js/FilterSubgrid":4,"./mix-ins/behavior":6,"./mix-ins/dataModel":7,"./mix-ins/grid":8}],2:[function(require,module,exports){
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

    this.schema.walk = popMenu.walk;
    this.schema.lookup = popMenu.lookup;
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
     * Overlays a custom schema on top of the derived schema.
     * This is an easy way to include hidden columns that might have been omitted from your custom schema.
     * @param customSchema
     */
    overlay: function(customSchema) {
        var lookup = this.schema.lookup;
        this.schema.walk(function(columnSchema) {
            return lookup.call(customSchema, function(customColumnSchema) {
                return customColumnSchema.name === columnSchema.name;
            });
        });
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

},{"pop-menu":24}],3:[function(require,module,exports){
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

    get enabled() {
        return this.columnFilters.children.length > 0 ||
            this.tableFilter.children.length > 0;
    },

    /**
     * @implements dataControlInterface#properties
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
            object = properties && properties.COLUMN
                ? this.schema.lookup(properties.COLUMN.name)
                : this.root;

        if (properties && object) {
            if (properties.GETTER) {
                result = object[alias(properties.GETTER)];
                if (result === undefined) {
                    result = null;
                }
            } else {
                for (var key in properties) {
                    value = properties[key];
                    if (typeof value === 'function' && !this.firstClassProperties[key]) {
                        object[alias(key)] = value();
                    } else {
                        object[alias(key)] = value;
                    }
                }
            }
        }

        return result;
    }
});

function alias(key) {
    if (key === 'header') {
        key = 'alias';
    }
    return key;
}


module.exports = DefaultFilter;

},{"./parser-CQL":5,"filter-tree":12}],4:[function(require,module,exports){
'use strict';

/**
 * @implements dataModelAPI
 * @param {Hypergrid} grid
 * @param {object} [options]
 * @param {string} [options.name]
 * @constructor
 */
function FilterSubgrid(grid, options) {
    this.grid = grid;
    this.behavior = grid.behavior;

    /**
     * @type {dataRowObject}
     */
    this.dataRow = {}; // for meta data (__HEIGHT)

    if (options && options.name) {
        this.name = options.name;
    }
}

FilterSubgrid.prototype = {
    constructor: FilterSubgrid.prototype.constructor,

    type: 'filter',

    format: 'filter', // override column format

    getRowCount: function() {
        return this.grid.properties.showFilterRow ? 1 : 0;
    },

    getValue: function(x, y) {
        return this.behavior.dataModel.getFilter(x) || '';
    },

    setValue: function(x, y, value) {
        this.behavior.dataModel.setFilter(x, value);
    },

    getRow: function(y) {
        return this.dataRow;
    }
};

module.exports = FilterSubgrid;

},{}],5:[function(require,module,exports){
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

},{"object-iterators":22}],6:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's filter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @param {dataControlInterface|undefined|null} filter - One of:
     * * A filter object, turning filter *ON*.
     * * `undefined`, the null filter is reassigned to the grid, turning filtering *OFF.*
     * @memberOf Behavior#
     */
    get filter() {
        return this.getController('filter');
    },
    set filter(filter) {
        this.setController('filter', filter);
    },

    /**
     * @param {number|string} columnIndexOrName - The _column filter_ to set.
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @param {boolean} [options.syntax='CQL'] - The syntax to use to describe the filter state. Note that `getFilter`'s default syntax, `'CQL'`, differs from the other get state methods.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior#
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
     * @memberOf Behavior#
     */
    setFilter: function(columnIndexOrName, state, options) {
        this.dataModel.setFilter(columnIndexOrName, state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior#
     */
    getFilters: function(options) {
        return this.dataModel.getFilters(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior#
     */
    setFilters: function(state, options) {
        this.dataModel.setFilters(state, options);
    },

    /**
     * @param {FilterTreeGetStateOptionsObject} [options] - Passed to the filter's {@link DefaultFilter#getState|getState} method.
     * @returns {FilterTreeStateObject}
     * @memberOf Behavior#
     */
    getTableFilter: function(options) {
        return this.dataModel.getTableFilter(options);
    },

    /**
     * @param {FilterTreeStateObject} state
     * @param {FilterTreeSetStateOptionsObject} [options] - Passed to the filter's [setState]{@link http://joneit.github.io/filter-tree/FilterTree.html#setState} method. You may mix in members of the {@link http://joneit.github.io/filter-tree/global.html#FilterTreeValidationOptionsObject|FilterTreeValidationOptionsObject}
     * @returns {undefined|Error|string} `undefined` indicates success.
     * @memberOf Behavior#
     */
    setTableFilter: function(state, options) {
        this.dataModel.setTableFilter(state, options);
    },

};

},{}],7:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The behaviors's filter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     * @param {dataControlInterface|undefined|null} filter - One of:
     * * A filter object, turning filter *ON*.
     * * `undefined`, the null filter is reassigned to the grid, turning filtering *OFF.*
     * @memberOf Behavior#
     */
    get filter() {
        return this.getController('filter');
    },
    set filter(filter) {
        this.setController('filter', filter);
    },

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

},{}],8:[function(require,module,exports){
'use strict';

module.exports = {

    /**
     * @summary The grid instance's filter data controller.
     * @desc This getter/setter is syntactic sugar for calls to `getController` and `setController`.
     *
     * In addition to a data model that accepts an data controller of type 'filter', to display the standard filter cells, the filter data controller also requires FilterSubgrid in the subgrids list.
     * @param {dataControlInterface|undefined|null} filter - One of:
     * * A filter object, turning filter *ON*.
     * * `undefined`, the null filter is reassigned to the grid, turning filtering *OFF.*
     * @memberOf Hypergrid#
     */
    get filter() {
        return this.getController('filter');
    },
    set filter(filter) {
        this.setController('filter', filter);
    },


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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{"overrider":23}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

},{"./js/Conditionals":13,"./js/FilterLeaf":14,"./js/FilterNode":15,"./js/FilterTree":16,"object-iterators":22,"pop-menu":24}],13:[function(require,module,exports){
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

},{"extend-me":10,"object-iterators":22,"regexp-like":25}],14:[function(require,module,exports){
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

    valOrFunc: function(dataRow, columnName, calculator) {
        var result;
        if (dataRow) {
            result = dataRow[columnName];
            calculator = (typeof result)[0] === 'f' ? result : calculator;
            if (calculator) {
                result = calculator(dataRow, columnName);
            }
        }
        return result || result === 0 || result === false ? result : '';
    },

    p: function(dataRow) {
        return this.valOrFunc(dataRow, this.column, this.calculator);
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
                option.alias || option.header || option.name || option,
                option.name || option.alias || option.header || option
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

},{"./Conditionals":13,"./FilterNode":15,"pop-menu":24}],15:[function(require,module,exports){
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

},{"./Conditionals":13,"./Templates":17,"./parser-SQL":19,"./stylesheet":20,"extend-me":10,"object-iterators":22,"pop-menu":24}],16:[function(require,module,exports){
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

},{"./FilterLeaf":14,"./FilterNode":15,"./extensions/columns":18,"./tree-operators":21,"object-iterators":22,"pop-menu":24,"unstrungify":27}],17:[function(require,module,exports){
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

},{"../html":11,"templex":26}],18:[function(require,module,exports){
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
        return this.valOrFunc(dataRow, this.operand, this.calculator);
    }
};

module.exports = ColumnLeaf;

},{"../Conditionals":13,"../FilterLeaf":14}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
'use strict';

var cssInjector = require('css-injector');

var css; // defined by code inserted by gulpfile between following comments
/* inject:css */
css = '.filter-tree{font-family:sans-serif;font-size:10pt;line-height:1.5em}.filter-tree label{font-weight:400}.filter-tree input[type=checkbox],.filter-tree input[type=radio]{margin-left:3px;margin-right:3px}.filter-tree ol{margin-top:0}.filter-tree>select{float:right;border:1px dotted grey;background-color:transparent;box-shadow:none}.filter-tree-remove-button{display:inline-block;width:15px;height:15px;border-radius:8px;background-color:#e88;font-size:11.5px;color:#fff;text-align:center;line-height:normal;font-style:normal;font-family:sans-serif;margin-right:4px;cursor:pointer}.filter-tree-remove-button:hover{background-color:transparent;color:#e88;font-weight:700;box-shadow:red 0 0 2px inset}.filter-tree-remove-button::before{content:\'\\d7\'}.filter-tree li::after{font-size:70%;font-style:italic;font-weight:700;color:#080}.filter-tree>ol>li:last-child::after{display:none}.op-and>ol,.op-nor>ol,.op-or>ol{padding-left:5px;margin-left:27px}.op-or>ol>li::after{margin-left:2.5em;content:\'— OR —\'}.op-and>ol>li::after{margin-left:2.5em;content:\'— AND —\'}.op-nor>ol>li::after{margin-left:2.5em;content:\'— NOR —\'}.filter-tree-editor>*{font-weight:700}.filter-tree-editor>span{font-size:smaller}.filter-tree-editor>input[type=text]{width:8em;padding:1px 5px 2px}.filter-tree-warning{background-color:#ffc!important;border-color:#edb!important;font-weight:400!important}.filter-tree-error{background-color:#fcc!important;border-color:#c99!important;font-weight:400!important}.filter-tree-default>:enabled{margin:0 .4em;background-color:#ddd;border:1px solid transparent}.filter-tree.filter-tree-type-column-filters>ol>li:not(:last-child){padding-bottom:.75em;border-bottom:3px double #080;margin-bottom:.75em}.filter-tree .footnotes{margin:0 0 6px;font-size:8pt;font-weight:400;line-height:normal;white-space:normal;color:#c00}.filter-tree .footnotes>p{margin:0}.filter-tree .footnotes>ul{margin:-3px 0 0;padding-left:17px;text-index:-6px}.filter-tree .footnotes>ul>li{margin:2px 0}.filter-tree .footnotes .field-name,.filter-tree .footnotes .field-value{font-weight:700;font-style:normal}.filter-tree .footnotes .field-value{font-family:monospace;color:#000;background-color:#ddd;padding:0 5px;margin:0 3px;border-radius:3px}';
/* endinject */

module.exports = cssInjector.bind(this, css, 'filter-tree-base');

},{"css-injector":9}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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

},{}],24:[function(require,module,exports){
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

},{}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
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

},{}],27:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLWZpbHRlci9mYWtlX2IyZTk0MzRmLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvQ29sdW1uU2NoZW1hRmFjdG9yeS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL2pzL0RlZmF1bHRGaWx0ZXIuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLWZpbHRlci9qcy9GaWx0ZXJTdWJncmlkLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvYWRkLW9ucy9oeXBlci1maWx0ZXIvanMvcGFyc2VyLUNRTC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL21peC1pbnMvYmVoYXZpb3IuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9hZGQtb25zL2h5cGVyLWZpbHRlci9taXgtaW5zL2RhdGFNb2RlbC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL2FkZC1vbnMvaHlwZXItZmlsdGVyL21peC1pbnMvZ3JpZC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9jc3MtaW5qZWN0b3IvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZXh0ZW5kLW1lL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2h0bWwvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvQ29uZGl0aW9uYWxzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL0ZpbHRlckxlYWYuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvRmlsdGVyTm9kZS5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9GaWx0ZXJUcmVlLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL1RlbXBsYXRlcy5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9leHRlbnNpb25zL2NvbHVtbnMuanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvZmlsdGVyLXRyZWUvanMvcGFyc2VyLVNRTC5qcyIsIi9Vc2Vycy9qb25hdGhhbi9yZXBvcy9maW4taHlwZXJncmlkL25vZGVfbW9kdWxlcy9maWx0ZXItdHJlZS9qcy9zdHlsZXNoZWV0LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL2ZpbHRlci10cmVlL2pzL3RyZWUtb3BlcmF0b3JzLmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL29iamVjdC1pdGVyYXRvcnMvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvb3ZlcnJpZGVyL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL3BvcC1tZW51L2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL3JlZ2V4cC1saWtlL2luZGV4LmpzIiwiL1VzZXJzL2pvbmF0aGFuL3JlcG9zL2Zpbi1oeXBlcmdyaWQvbm9kZV9tb2R1bGVzL3RlbXBsZXgvaW5kZXguanMiLCIvVXNlcnMvam9uYXRoYW4vcmVwb3MvZmluLWh5cGVyZ3JpZC9ub2RlX21vZHVsZXMvdW5zdHJ1bmdpZnkvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2poQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBEZWZhdWx0RmlsdGVyID0gcmVxdWlyZSgnLi9qcy9EZWZhdWx0RmlsdGVyJyk7XG52YXIgQ29sdW1uU2NoZW1hRmFjdG9yeSA9IHJlcXVpcmUoJy4vanMvQ29sdW1uU2NoZW1hRmFjdG9yeScpO1xudmFyIEZpbHRlclN1YmdyaWQgPSByZXF1aXJlKCcuL2pzL0ZpbHRlclN1YmdyaWQnKTtcblxuLyoqXG4gKiBAcGFyYW0ge0h5cGVyZ3JpZH0gZ3JpZFxuICogQHBhcmFtIHtvYmplY3R9IFt0YXJnZXRzXSAtIEhhc2ggb2YgbWl4aW4gdGFyZ2V0cy4gVGhlc2UgYXJlIHR5cGljYWxseSBwcm90b3R5cGUgb2JqZWN0cy4gSWYgbm90IGdpdmVuIG9yIGFueSB0YXJnZXRzIGFyZSBtaXNzaW5nLCBkZWZhdWx0cyB0byBjdXJyZW50IGdyaWQncyB2YXJpb3VzIHByb3RvdHlwZXMuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gSHlwZXJmaWx0ZXIoZ3JpZCwgdGFyZ2V0cykge1xuICAgIHRoaXMuZ3JpZCA9IGdyaWQ7XG4gICAgdGhpcy5pbnN0YWxsKHRhcmdldHMpO1xufVxuXG5IeXBlcmZpbHRlci5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IEh5cGVyZmlsdGVyLnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgIG5hbWU6ICdIeXBlcmZpbHRlcicsXG5cbiAgICBpbnN0YWxsOiBmdW5jdGlvbih0YXJnZXRzKSB7XG4gICAgICAgIHRhcmdldHMgPSB0YXJnZXRzIHx8IHt9O1xuXG4gICAgICAgIHZhciBiZWhhdmlvciA9IHRoaXMuZ3JpZC5iZWhhdmlvcixcbiAgICAgICAgICAgIEJlaGF2aW9yUHJvdG90eXBlID0gdGFyZ2V0cy5CZWhhdmlvclByb3RvdHlwZSB8fCB0YXJnZXRzLkJlaGF2aW9yICYmIHRhcmdldHMuQmVoYXZpb3IucHJvdG90eXBlLFxuICAgICAgICAgICAgRGF0YU1vZGVsUHJvdG90eXBlID0gdGFyZ2V0cy5EYXRhTW9kZWxQcm90b3R5cGUgfHwgdGFyZ2V0cy5EYXRhTW9kZWwgJiYgdGFyZ2V0cy5EYXRhTW9kZWwucHJvdG90eXBlIHx8IE9iamVjdC5nZXRQcm90b3R5cGVPZihiZWhhdmlvci5kYXRhTW9kZWwpLFxuICAgICAgICAgICAgc3ViZ3JpZHMgPSBiZWhhdmlvci5zdWJncmlkcztcblxuICAgICAgICBpZiAoIUJlaGF2aW9yUHJvdG90eXBlKSB7XG4gICAgICAgICAgICBCZWhhdmlvclByb3RvdHlwZSA9IGJlaGF2aW9yO1xuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIEJlaGF2aW9yUHJvdG90eXBlID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKEJlaGF2aW9yUHJvdG90eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoQmVoYXZpb3JQcm90b3R5cGUuJCRDTEFTU19OQU1FICE9PSAnQmVoYXZpb3InKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGluIGNhc2UgYSBzdWJncmlkIGxpc3QgaXMgaW5jbHVkZWQgaW4gc3RhdGUgb2JqZWN0IG9mIGEgc3Vic2VxdWVudCBncmlkIGluc3RhbnRpYXRpb25cbiAgICAgICAgYmVoYXZpb3IuZGF0YU1vZGVscy5GaWx0ZXJTdWJncmlkID0gRmlsdGVyU3ViZ3JpZDtcblxuICAgICAgICBpZiAoIXN1YmdyaWRzLmxvb2t1cC5maWx0ZXIpIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHN1YmdyaWRzLmluZGV4T2Yoc3ViZ3JpZHMubG9va3VwLmhlYWRlcikgKyAxLFxuICAgICAgICAgICAgICAgIHN1YmdyaWQgPSBiZWhhdmlvci5jcmVhdGVTdWJncmlkKEZpbHRlclN1YmdyaWQpO1xuICAgICAgICAgICAgc3ViZ3JpZHMuc3BsaWNlKGluZGV4LCAwLCBzdWJncmlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzLmdyaWQpLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9ncmlkJykpO1xuXG4gICAgICAgIEJlaGF2aW9yUHJvdG90eXBlLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9iZWhhdmlvcicpKTtcbiAgICAgICAgRGF0YU1vZGVsUHJvdG90eXBlLm1peEluKHJlcXVpcmUoJy4vbWl4LWlucy9kYXRhTW9kZWwnKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE1heSBiZSBhZGp1c3RlZCBiZWZvcmUgY2FsbGluZyB7QGxpbmsgSHlwZXJGaWx0ZXIjY3JlYXRlfGNyZWF0ZX0uXG4gICAgICogQGRlZmF1bHRcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXNlU2Vuc2l0aXZlRGF0YTogdHJ1ZSxcblxuICAgIC8qKlxuICAgICAqIE1heSBiZSBhZGp1c3RlZCBiZWZvcmUgY2FsbGluZyB7QGxpbmsgSHlwZXJGaWx0ZXIjY3JlYXRlfGNyZWF0ZX0uXG4gICAgICogQGRlZmF1bHRcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXNlU2Vuc2l0aXZlQ29sdW1uTmFtZXM6IHRydWUsXG5cbiAgICAvKipcbiAgICAgKiBNYXkgYmUgYWRqdXN0ZWQgYmVmb3JlIGNhbGxpbmcge0BsaW5rIEh5cGVyRmlsdGVyI2NyZWF0ZXxjcmVhdGV9LlxuICAgICAqIEBkZWZhdWx0XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgcmVzb2x2ZUFsaWFzZXM6IGZhbHNlLFxuXG4gICAgLyoqXG4gICAgICogTWF5IGJlIGFkanVzdGVkIGJlZm9yZSBjYWxsaW5nIHtAbGluayBIeXBlckZpbHRlciNjcmVhdGV8Y3JlYXRlfS5cbiAgICAgKiBAZGVmYXVsdFxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yOiAnJywgLy8gYmxhbmsgbWVhbnMgdXNlIGRlZmF1bHQgKCc9JylcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258bWVudUl0ZW1bXX0gW3NjaGVtYV0gLSBJZiBvbWl0dGVkLCBkZXJpdmVzIGEgc2NoZW1hLiBJZiBhIGZ1bmN0aW9uLCBkZXJpdmVzIGEgc2NoZW1hIGFuZCBjYWxscyBpdCB3aXRoIGZvciBwb3NzaWJsZSBtb2RpZmljYXRpb25zXG4gICAgICovXG4gICAgY3JlYXRlOiBmdW5jdGlvbihzY2hlbWEpIHtcbiAgICAgICAgaWYgKCFzY2hlbWEpIHtcbiAgICAgICAgICAgIHNjaGVtYSA9IG5ldyBDb2x1bW5TY2hlbWFGYWN0b3J5KHRoaXMuZ3JpZC5iZWhhdmlvci5hbGxDb2x1bW5zKS5zY2hlbWE7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNjaGVtYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdmFyIGZhY3RvcnkgPSBuZXcgQ29sdW1uU2NoZW1hRmFjdG9yeSh0aGlzLmdyaWQuYmVoYXZpb3IuYWxsQ29sdW1ucyk7XG4gICAgICAgICAgICBzY2hlbWEuY2FsbChmYWN0b3J5KTtcbiAgICAgICAgICAgIHNjaGVtYSA9IGZhY3Rvcnkuc2NoZW1hO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgRGVmYXVsdEZpbHRlcih7XG4gICAgICAgICAgICBzY2hlbWE6IHNjaGVtYSxcbiAgICAgICAgICAgIGNhc2VTZW5zaXRpdmVEYXRhOiB0aGlzLmNhc2VTZW5zaXRpdmVEYXRhLFxuICAgICAgICAgICAgY2FzZVNlbnNpdGl2ZUNvbHVtbk5hbWVzOiB0aGlzLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lcyxcbiAgICAgICAgICAgIHJlc29sdmVBbGlhc2VzOiB0aGlzLnJlc29sdmVBbGlhc2VzLFxuICAgICAgICAgICAgZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yOiB0aGlzLmRlZmF1bHRDb2x1bW5GaWx0ZXJPcGVyYXRvclxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh5cGVyZmlsdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbi8qKlxuICogQGNsYXNzZGVzYyBCdWlsZCwgb3JnYW5pemUsIGFuZCBzb3J0IGEgY29sdW1uIHNjaGVtYSBsaXN0IGZyb20gYSBsaXN0IG9mIGNvbHVtbnMuXG4gKlxuICogRmlsdGVyVHJlZSByZXF1aXJlcyBhIGNvbHVtbiBzY2hlbWEuIEFzIGEgZmFsbGJhY2sgd2hlbiB5b3UgZG9uJ3QgaGF2ZSBhIGNvbHVtbiBzY2hlbWEgb2YgeW91ciBvd24sIHRoZSBzdHJpbmcgYXJyYXkgcmV0dXJuZWQgYnkgYmVoYXZpb3IuZGF0YU1vZGVsLmdldEZpZWxkcygpIHdvdWxkIHdvcmsgYXMgaXMuIFRoaXMgZmFjdG9yeSBvYmplY3Qgd2lsbCBkbyBhIGxpdHRsZSBiZXR0ZXIgdGhhbiB0aGF0LCB0YWtpbmcgSHlwZXJncmlkJ3MgY29sdW1uIGFycmF5IGFuZCBjcmVhdGluZyBhIG1vcmUgdGV4dHVyZWQgY29sdW1uIHNjaGVtYSwgaW5jbHVkaW5nIGNvbHVtbiBhbGlhc2VzIGFuZCB0eXBlcy5cbiAqXG4gKiBDQVZFQVQ6IFNldCB1cCB0aGUgc2NoZW1hIGNvbXBsZXRlbHkgYmVmb3JlIGluc3RhbnRpYXRpbmcgeW91ciBmaWx0ZXIgc3RhdGUuIEZpbHRlci10cmVlIHVzZXMgdGhlIHNjaGVtYSAoaW4gcGFydCkgdG8gZ2VuZXJhdGUgY29sdW1uIHNlbGVjdGlvbiBkcm9wLWRvd25zIGFzIHBhcnQgb2YgaXRzIFwicXVlcnkgYnVpbGRlclwiIFVJLiBOb3RlIHRoYXQgdGhlIFVJIGlzICpub3QqIGF1dG9tYXRpY2FsbHkgdXBkYXRlZCBpZiB5b3UgY2hhbmdlIHRoZSBzY2hlbWEgbGF0ZXIuXG4gKlxuICogQHBhcmFtIHtDb2x1bW5bXX0gY29sdW1uc1xuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIENvbHVtblNjaGVtYUZhY3RvcnkoY29sdW1ucykge1xuICAgIC8qKlxuICAgICAqIFRoaXMgaXMgdGhlIG91dHB1dCBwcm9kdWNlZCBieSB0aGUgZmFjdG9yeS5cbiAgICAgKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAgICAgKi9cbiAgICB0aGlzLnNjaGVtYSA9IGNvbHVtbnMubWFwKGZ1bmN0aW9uKGNvbHVtbikge1xuICAgICAgICB2YXIgaXRlbSA9IHtcbiAgICAgICAgICAgIG5hbWU6IGNvbHVtbi5uYW1lLFxuICAgICAgICAgICAgYWxpYXM6IGNvbHVtbi5oZWFkZXIsXG4gICAgICAgICAgICB0eXBlOiBjb2x1bW4uZ2V0VHlwZSgpXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGNvbHVtbi5jYWxjdWxhdG9yKSB7XG4gICAgICAgICAgICBpdGVtLmNhbGN1bGF0b3IgPSBjb2x1bW4uY2FsY3VsYXRvcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zY2hlbWEud2FsayA9IHBvcE1lbnUud2FsaztcbiAgICB0aGlzLnNjaGVtYS5sb29rdXAgPSBwb3BNZW51Lmxvb2t1cDtcbn1cblxudmFyIHBsYWNlbWVudFByZWZpeE1hcCA9IHtcbiAgICB0b3A6ICdcXHUwMDAwJyxcbiAgICBib3R0b206ICdcXHVmZmZmJyxcbiAgICB1bmRlZmluZWQ6ICcnXG59O1xuXG5Db2x1bW5TY2hlbWFGYWN0b3J5LnByb3RvdHlwZSA9IHtcblxuICAgIGNvbnN0cnVjdG9yOiBDb2x1bW5TY2hlbWFGYWN0b3J5LnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgIC8qKlxuICAgICAqIE9yZ2FuaXplIHNjaGVtYSBpbnRvIHN1Ym1lbnVzLlxuICAgICAqIEBwYXJhbSB7UmVnRXhwfSBjb2x1bW5Hcm91cHNSZWdleCAtIFNjaGVtYSBuYW1lcyBvciBhbGlhc2VzIHRoYXQgbWF0Y2ggdGhpcyBhcmUgcHV0IGludG8gYSBzdWJtZW51LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5rZXk9J25hbWUnXSAtIE11c3QgYmUgZWl0aGVyICduYW1lJyBvciAnYWxpYXMnLlxuICAgICAqL1xuICAgIG9yZ2FuaXplOiBmdW5jdGlvbihjb2x1bW5Hcm91cHNSZWdleCwgb3B0aW9ucykge1xuICAgICAgICB2YXIga2V5ID0gb3B0aW9ucyAmJiBvcHRpb25zLmtleSB8fCAnbmFtZScsXG4gICAgICAgICAgICBzdWJtZW51cyA9IHt9LFxuICAgICAgICAgICAgbWVudSA9IFtdO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gaXRlbVtrZXldLFxuICAgICAgICAgICAgICAgIGdyb3VwID0gdmFsdWUubWF0Y2goY29sdW1uR3JvdXBzUmVnZXgpO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgZ3JvdXAgPSBncm91cFswXTtcbiAgICAgICAgICAgICAgICBpZiAoIShncm91cCBpbiBzdWJtZW51cykpIHtcbiAgICAgICAgICAgICAgICAgICAgc3VibWVudXNbZ3JvdXBdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGdyb3VwLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJtZW51OiBbXVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdWJtZW51c1tncm91cF0uc3VibWVudS5wdXNoKGl0ZW0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW51LnB1c2goaXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAodmFyIHN1Ym1lbnVOYW1lIGluIHN1Ym1lbnVzKSB7XG4gICAgICAgICAgICBtZW51LnB1c2goc3VibWVudXNbc3VibWVudU5hbWVdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gbWVudTtcbiAgICB9LFxuXG4gICAgbG9va3VwOiBmdW5jdGlvbihmaW5kT3B0aW9ucywgdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHBvcE1lbnUubG9va3VwLmFwcGx5KHRoaXMuc2NoZW1hLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICB3YWxrOiBmdW5jdGlvbihpdGVyYXRlZSkge1xuICAgICAgICByZXR1cm4gcG9wTWVudS53YWxrLmFwcGx5KHRoaXMuc2NoZW1hLCBhcmd1bWVudHMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBPdmVybGF5cyBhIGN1c3RvbSBzY2hlbWEgb24gdG9wIG9mIHRoZSBkZXJpdmVkIHNjaGVtYS5cbiAgICAgKiBUaGlzIGlzIGFuIGVhc3kgd2F5IHRvIGluY2x1ZGUgaGlkZGVuIGNvbHVtbnMgdGhhdCBtaWdodCBoYXZlIGJlZW4gb21pdHRlZCBmcm9tIHlvdXIgY3VzdG9tIHNjaGVtYS5cbiAgICAgKiBAcGFyYW0gY3VzdG9tU2NoZW1hXG4gICAgICovXG4gICAgb3ZlcmxheTogZnVuY3Rpb24oY3VzdG9tU2NoZW1hKSB7XG4gICAgICAgIHZhciBsb29rdXAgPSB0aGlzLnNjaGVtYS5sb29rdXA7XG4gICAgICAgIHRoaXMuc2NoZW1hLndhbGsoZnVuY3Rpb24oY29sdW1uU2NoZW1hKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9va3VwLmNhbGwoY3VzdG9tU2NoZW1hLCBmdW5jdGlvbihjdXN0b21Db2x1bW5TY2hlbWEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VzdG9tQ29sdW1uU2NoZW1hLm5hbWUgPT09IGNvbHVtblNjaGVtYS5uYW1lO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTb3J0IHRoZSBzY2hlbWEuXG4gICAgICogQGRlc2MgV2FsayB0aGUgbWVudSBzdHJ1Y3R1cmUsIHNvcnRpbmcgZWFjaCBzdWJtZW51IHVudGlsIGZpbmFsbHkgdGhlIHRvcC1sZXZlbCBtZW51IGlzIHNvcnRlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtzdWJtZW51UGxhY2VtZW50XSAtIE9uZSBvZjpcbiAgICAgKiAqIGAndG9wJ2AgLSBQbGFjZSBhbGwgdGhlIHN1Ym1lbnVzIGF0IHRoZSB0b3Agb2YgZWFjaCBlbmNsb3Npbmcgc3VibWVudS5cbiAgICAgKiAqIGAnYm90dG9tJ2AgLSBQbGFjZSBhbGwgdGhlIHN1Ym1lbnVzIGF0IHRoZSBib3R0b20gb2YgZWFjaCBlbmNsb3Npbmcgc3VibWVudS5cbiAgICAgKiAqIGB1bmRlZmluZWRgIChvciBvbWl0dGVkKSAtIEdpdmUgbm8gc3BlY2lhbCB0cmVhdG1lbnQgdG8gc3VibWVudXMuXG4gICAgICovXG4gICAgc29ydDogZnVuY3Rpb24oc3VibWVudVBsYWNlbWVudCkge1xuICAgICAgICB2YXIgcHJlZml4ID0gcGxhY2VtZW50UHJlZml4TWFwW3N1Ym1lbnVQbGFjZW1lbnRdO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hLnNvcnQoZnVuY3Rpb24gcmVjdXJzZShhLCBiKSB7XG4gICAgICAgICAgICBpZiAoYS5sYWJlbCAmJiAhYS5zb3J0ZWQpIHtcbiAgICAgICAgICAgICAgICBhLnN1Ym1lbnUuc29ydChyZWN1cnNlKTtcbiAgICAgICAgICAgICAgICBhLnNvcnRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhID0gYS5sYWJlbCA/IHByZWZpeCArIGEubGFiZWwgOiBhLmFsaWFzIHx8IGEubmFtZSB8fCBhO1xuICAgICAgICAgICAgYiA9IGIubGFiZWwgPyBwcmVmaXggKyBiLmxhYmVsIDogYi5hbGlhcyB8fCBiLm5hbWUgfHwgYjtcbiAgICAgICAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA+IGIgPyAxIDogMDtcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2x1bW5TY2hlbWFGYWN0b3J5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRmlsdGVyVHJlZSA9IHJlcXVpcmUoJ2ZpbHRlci10cmVlJyk7XG52YXIgUGFyc2VyQ1FMID0gcmVxdWlyZSgnLi9wYXJzZXItQ1FMJyk7XG5cbi8vIEFkZCBhIHByb3BlcnR5IGBtZW51TW9kZXNgIHRvIHRoIGUgdHJlZSwgZGVmYXVsdGluZyB0byBgb3BlcmF0b3JzYCBhcyB0aGUgb25seSBhY3RpdmUgbW9kZVxuRmlsdGVyVHJlZS5Ob2RlLm9wdGlvbnNTY2hlbWEubWVudU1vZGVzID0ge1xuICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgb3BlcmF0b3JzOiAxXG4gICAgfVxufTtcblxuLy8gQWRkIGBvcE1lbnVHcm91cHNgIHRvIHByb3RvdHlwZSBiZWNhdXNlIG5lZWRlZCBieSBGaWx0ZXJCb3guXG5GaWx0ZXJUcmVlLk5vZGUucHJvdG90eXBlLm9wTWVudUdyb3VwcyA9IEZpbHRlclRyZWUuQ29uZGl0aW9uYWxzLmdyb3VwcztcblxuZnVuY3Rpb24gcXVvdGUodGV4dCkge1xuICAgIHZhciBxdCA9IFBhcnNlckNRTC5xdDtcbiAgICByZXR1cm4gcXQgKyB0ZXh0LnJlcGxhY2UobmV3IFJlZ0V4cChxdCwgJ2cnKSwgcXQgKyBxdCkgKyBxdDtcbn1cblxudmFyIGxpa2VEcmVzc2VzID0gW1xuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgJSguKyklJC9pLCBvcGVyYXRvcjogJ2NvbnRhaW5zJyB9LFxuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgKC4rKSUkL2ksIG9wZXJhdG9yOiAnYmVnaW5zJyB9LFxuICAgIHsgcmVnZXg6IC9eKE5PVCApP0xJS0UgJSguKykkL2ksIG9wZXJhdG9yOiAnZW5kcycgfVxuXTtcbnZhciByZWdleEVzY2FwZWRMaWtlUGF0dGVybkNoYXJzID0gL1xcWyhbX1xcW1xcXSVdKVxcXS9nOyAvLyBjYXB0dXJlIGFsbCBfLCBbLCBdLCBhbmQgJSBjaGFycyBlbmNsb3NlZCBpbiBbXVxudmFyIHJlZ2V4TGlrZVBhdHRlcm5DaGFyID0gL1tfXFxbXFxdJV0vOyAvLyBmaW5kIGFueSBfLCBbLCBdLCBhbmQgJSBjaGFycyBOT1QgZW5jbG9zZWQgaW4gW11cblxuLy8gY29udmVydCBjZXJ0YWluIExJS0UgZXhwcmVzc2lvbnMgdG8gQkVHSU5TLCBFTkRTLCBDT05UQUlOU1xuZnVuY3Rpb24gY29udmVydExpa2VUb1BzZXVkb09wKHJlc3VsdCkge1xuICAgIGxpa2VEcmVzc2VzLmZpbmQoZnVuY3Rpb24oZHJlc3MpIHtcbiAgICAgICAgdmFyIG1hdGNoID0gcmVzdWx0Lm1hdGNoKGRyZXNzLnJlZ2V4KTtcblxuICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgIC8vIHVuZXNjYXBlIGFsbCBMSUtFIHBhdHRlcm4gY2hhcnMgZXNjYXBlZCB3aXRoIGJyYWNrZXRzXG4gICAgICAgICAgICB2YXIgbm90ID0gKG1hdGNoWzFdIHx8ICcnKS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIG9wZXJhdG9yID0gZHJlc3Mub3BlcmF0b3IsXG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1hdGNoWzJdLFxuICAgICAgICAgICAgICAgIG9wZXJhbmRXaXRob3V0RXNjYXBlZENoYXJzID0gb3BlcmFuZC5yZXBsYWNlKHJlZ2V4RXNjYXBlZExpa2VQYXR0ZXJuQ2hhcnMsICcnKTtcblxuICAgICAgICAgICAgLy8gaWYgcmVzdWx0IGhhcyBubyBhY3R1YSByZW1haW5pbmcgTElLRSBwYXR0ZXJuIGNoYXJzLCBnbyB3aXRoIHRoZSBjb252ZXJzaW9uXG4gICAgICAgICAgICBpZiAoIXJlZ2V4TGlrZVBhdHRlcm5DaGFyLnRlc3Qob3BlcmFuZFdpdGhvdXRFc2NhcGVkQ2hhcnMpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG9wZXJhbmQucmVwbGFjZShyZWdleEVzY2FwZWRMaWtlUGF0dGVybkNoYXJzLCAnJDEnKTsgLy8gdW5lc2NhcGUgdGhlIGVzY2FwZWQgY2hhcnNcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBub3QgKyBvcGVyYXRvciArICcgJyArIG9wZXJhbmQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBicmVhayBvdXQgb2YgbG9vcFxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG52YXIgY29uZGl0aW9uYWxzQ1FMID0gbmV3IEZpbHRlclRyZWUuQ29uZGl0aW9uYWxzKCk7XG5jb25kaXRpb25hbHNDUUwubWFrZUxJS0UgPSBmdW5jdGlvbihiZWcsIGVuZCwgb3AsIG9yaWdpbmFsT3AsIGMpIHtcbiAgICBvcCA9IG9yaWdpbmFsT3AudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gb3AgKyAnICcgKyBxdW90ZShjLm9wZXJhbmQpO1xufTtcbmNvbmRpdGlvbmFsc0NRTC5tYWtlSU4gPSBmdW5jdGlvbihvcCwgYykge1xuICAgIHJldHVybiBvcC50b0xvd2VyQ2FzZSgpICsgJyAoJyArIGMub3BlcmFuZC5yZXBsYWNlKC9cXHMqLFxccyovZywgJywgJykgKyAnKSc7XG59O1xuY29uZGl0aW9uYWxzQ1FMLm1ha2UgPSBmdW5jdGlvbihvcCwgYykge1xuICAgIHZhciBudW1lcmljT3BlcmFuZDtcbiAgICBvcCA9IG9wLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKC9cXHcvLnRlc3Qob3ApKSB7IG9wICs9ICcgJzsgfVxuICAgIG9wICs9IGMuZ2V0VHlwZSgpID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obnVtZXJpY09wZXJhbmQgPSBOdW1iZXIoYy5vcGVyYW5kKSlcbiAgICAgICAgPyBudW1lcmljT3BlcmFuZFxuICAgICAgICA6IHF1b3RlKGMub3BlcmFuZCk7XG4gICAgcmV0dXJuIG9wO1xufTtcblxuLy8gcmVwbGFjZSB0aGUgZGVmYXVsdCBmaWx0ZXIgdHJlZSB0ZXJtaW5hbCBub2RlIGNvbnN0cnVjdG9yIHdpdGggYW4gZXh0ZW5zaW9uIG9mIHNhbWVcbnZhciBDdXN0b21GaWx0ZXJMZWFmID0gRmlsdGVyVHJlZS5wcm90b3R5cGUuYWRkRWRpdG9yKHtcbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0LFxuICAgICAgICAgICAgc3ludGF4ID0gb3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheDtcblxuICAgICAgICBpZiAoc3ludGF4ID09PSAnQ1FMJykge1xuICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy5nZXRTeW50YXgoY29uZGl0aW9uYWxzQ1FMKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGNvbnZlcnRMaWtlVG9Qc2V1ZG9PcChyZXN1bHQpO1xuICAgICAgICAgICAgdmFyIGRlZmF1bHRPcCA9IHRoaXMuc2NoZW1hLmxvb2t1cCh0aGlzLmNvbHVtbikuZGVmYXVsdE9wIHx8IHRoaXMucm9vdC5wYXJzZXJDUUwuZGVmYXVsdE9wOyAvLyBtaW1pY3MgbG9naWMgaW4gcGFyc2VyLUNRTC5qcywgbGluZSAxMTBcbiAgICAgICAgICAgIGlmIChyZXN1bHQudG9VcHBlckNhc2UoKS5pbmRleE9mKGRlZmF1bHRPcCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHQuc3Vic3RyKGRlZmF1bHRPcC5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gRmlsdGVyVHJlZS5MZWFmLnByb3RvdHlwZS5nZXRTdGF0ZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59KTtcblxuRmlsdGVyVHJlZS5wcm90b3R5cGUuYWRkRWRpdG9yKCdDb2x1bW5zJyk7XG5cbi8vIEFkZCBzb21lIG5vZGUgdGVtcGxhdGVzIGJ5IHVwZGF0aW5nIHNoYXJlZCBpbnN0YW5jZSBvZiBGaWx0ZXJOb2RlJ3MgdGVtcGxhdGVzLiAoT0sgdG8gbXV0YXRlIHNoYXJlZCBpbnN0YW5jZTsgZmlsdGVyLXRyZWUgbm90IGJlaW5nIHVzZWQgZm9yIGFueXRoaW5nIGVsc2UgaGVyZS4gQWx0ZXJuYXRpdmVseSwgd2UgY291bGQgaGF2ZSBpbnN0YW50aWF0ZWQgYSBuZXcgVGVtcGxhdGVzIG9iamVjdCBmb3Igb3VyIERlZmF1bHRGaWx0ZXIgcHJvdG90eXBlLCBhbHRob3VnaCB0aGlzIHdvdWxkIG9ubHkgYWZmZWN0IHRyZWUgbm9kZXMsIG5vdCBsZWFmIG5vZGVzLCBidXQgdGhhdCB3b3VsZCBiZSBvayBpbiB0aGlzIGNhc2Ugc2luY2UgdGhlIGFkZGl0aW9ucyBiZWxvdyBhcmUgdHJlZSBub2RlIHRlbXBsYXRlcy4pXG5PYmplY3QuYXNzaWduKEZpbHRlclRyZWUuTm9kZS5wcm90b3R5cGUudGVtcGxhdGVzLCB7XG4gICAgY29sdW1uRmlsdGVyOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbiAgICAgICAgJyAgIDxzdHJvbmc+PHNwYW4+ezJ9IDwvc3Bhbj48L3N0cm9uZz48YnI+JyxcbiAgICAgICAgJyAgIE1hdGNoJyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1hbmRcIj5hbGw8L2xhYmVsPicsXG4gICAgICAgICcgICA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3Atbm9yXCI+bm9uZTwvbGFiZWw+JyxcbiAgICAgICAgJyAgIG9mIHRoZSBmb2xsb3dpbmc6JyxcbiAgICAgICAgJyAgIDxzZWxlY3Q+JyxcbiAgICAgICAgJyAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4gICAgICAgICcgICA8L3NlbGVjdD4nLFxuICAgICAgICAnICAgPG9sPjwvb2w+JyxcbiAgICAgICAgJzwvc3Bhbj4nXG4gICAgXVxuICAgICAgICAuam9pbignXFxuJyksXG5cbiAgICBjb2x1bW5GaWx0ZXJzOiBbXG4gICAgICAgICc8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlIGZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnNcIj4nLFxuICAgICAgICAnICAgTWF0Y2ggPHN0cm9uZz5hbGw8L3N0cm9uZz4gb2YgdGhlIGZvbGxvd2luZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb25zOicsXG4gICAgICAgICcgICA8b2w+PC9vbD4nLFxuICAgICAgICAnPC9zcGFuPidcbiAgICBdXG4gICAgICAgIC5qb2luKCdcXG4nKVxufSk7XG5cbi8qKiBAY29uc3RydWN0b3JcbiAqXG4gKiBAZGVzYyBUaGlzIGV4dGVuc2lvbiBvZiBGaWx0ZXJUcmVlIGZvcmNlcyBhIHNwZWNpZmljIHRyZWUgc3RydWN0dXJlLlxuICogU2VlIHtAbGluayBtYWtlTmV3Um9vdH0gZm9yIGEgZGVzY3JpcHRpb24uXG4gKlxuICogU2VlIGFsc28ge0B0dXRvcmlhbCBmaWx0ZXItYXBpfS5cbiAqXG4gKiBAcGFyYW0ge0ZpbHRlclRyZWVPcHRpb25zT2JqZWN0fSBvcHRpb25zIC0gWW91IHNob3VsZCBwcm92aWRlIGEgY29sdW1uIHNjaGVtYS4gVGhlIGVhc2llc3QgYXBwcm9hY2ggaXMgdG8gcHJvdmlkZSBhIHNjaGVtYSBmb3IgdGhlIGVudGlyZSBmaWx0ZXIgdHJlZSB0aHJvdWdoIGBvcHRpb25zLnNjaGVtYWAuXG4gKlxuICogQWx0aG91Z2ggbm90IHJlY29tbWVuZGVkLCB0aGUgY29sdW1uIHNjaGVtYSBjYW4gYWxzbyBiZSBlbWJlZGRlZCBpbiB0aGUgc3RhdGUgb2JqZWN0LCBlaXRoZXIgYXQgdGhlIHJvb3QsIGBvcHRpb25zLnN0YXRlLnNjaGVtYWAsIG9yIGZvciBhbnkgZGVzY2VuZGFudCBub2RlLiBGb3IgZXhhbXBsZSwgYSBzZXBhcmF0ZSBzY2hlbWEgY291bGQgYmUgcHJvdmlkZWQgZm9yIGVhY2ggZXhwcmVzc2lvbiBvciBzdWJleHByZXNzaW9uIHRoYXQgbmVlZCB0byByZW5kZXIgY29sdW1uIGxpc3QgZHJvcC1kb3ducy5cbiAqXG4gKiBOT1RFOiBJZiBgb3B0aW9ucy5zdGF0ZWAgaXMgdW5kZWZpbmVkLCBpdCBpcyBkZWZpbmVkIGluIGBwcmVJbml0aWFsaXplKClgIGFzIGEgbmV3IGVtcHR5IHN0YXRlIHNjYWZmb2xkIChzZWUge0BsaW5rIG1ha2VOZXdSb290fSkgd2l0aCB0aGUgdHdvIHRydW5rcyB0byBob2xkIGEgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycy4gRXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGNhbiBiZSBhZGRlZCB0byB0aGlzIGVtcHR5IHNjYWZmb2xkIGVpdGhlciBwcm9ncmFtbWF0aWNhbGx5IG9yIHRocm91Z2ggdGhlIFF1ZXJ5IEJ1aWxkZXIgVUkuXG4gKi9cbnZhciBEZWZhdWx0RmlsdGVyID0gRmlsdGVyVHJlZS5leHRlbmQoJ0RlZmF1bHRGaWx0ZXInLCB7XG4gICAgcHJlSW5pdGlhbGl6ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAvLyBTZXQgdXAgdGhlIGRlZmF1bHQgXCJIeXBlcmZpbHRlclwiIHByb2ZpbGUgKHNlZSBmdW5jdGlvbiBjb21tZW50cylcbiAgICAgICAgdmFyIHN0YXRlID0gb3B0aW9ucy5zdGF0ZSA9IG9wdGlvbnMuc3RhdGUgfHwgdGhpcy5tYWtlTmV3Um9vdCgpO1xuXG4gICAgICAgIC8vIFVwb24gY3JlYXRpb24gb2YgYSAnY29sdW1uRmlsdGVyJyBub2RlLCBmb3JjZSB0aGUgc2NoZW1hIHRvIHRoZSBvbmUgY29sdW1uXG4gICAgICAgIGlmICgob3B0aW9ucy50eXBlIHx8IHN0YXRlICYmIHN0YXRlLnR5cGUpID09PSAnY29sdW1uRmlsdGVyJykge1xuICAgICAgICAgICAgdGhpcy5zY2hlbWEgPSBbXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnQucm9vdC5zY2hlbWEubG9va3VwKHN0YXRlLmNoaWxkcmVuWzBdLmNvbHVtbilcbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW29wdGlvbnNdO1xuICAgIH0sXG5cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcblxuICAgICAgICBpZiAoIXRoaXMucGFyZW50KSB7XG4gICAgICAgICAgICB0aGlzLmV4dHJhY3RTdWJ0cmVlcygpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHBvc3RJbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGlmICh0aGlzID09PSB0aGlzLnJvb3QgJiYgIXRoaXMucGFyc2VyQ1FMKSB7XG4gICAgICAgICAgICB0aGlzLnBhcnNlckNRTCA9IG5ldyBQYXJzZXJDUUwodGhpcy5jb25kaXRpb25hbHMub3BzLCB7XG4gICAgICAgICAgICAgICAgc2NoZW1hOiB0aGlzLnNjaGVtYSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0T3A6IG9wdGlvbnMuZGVmYXVsdENvbHVtbkZpbHRlck9wZXJhdG9yXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09ICdjb2x1bW5GaWx0ZXInKSB7XG4gICAgICAgICAgICB0aGlzLmRvbnRQZXJzaXN0LnNjaGVtYSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGNvbnZlbmllbmNlIHZhcnMgdG8gcmVmZXJlbmNlIHRoZSAyIHJvb3QgXCJIeXBlcmZpbHRlclwiIG5vZGVzXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgZXh0cmFjdFN1YnRyZWVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJvb3ROb2RlcyA9IHRoaXMucm9vdC5jaGlsZHJlbjtcbiAgICAgICAgdGhpcy50YWJsZUZpbHRlciA9IHJvb3ROb2Rlc1swXTtcbiAgICAgICAgdGhpcy5jb2x1bW5GaWx0ZXJzID0gcm9vdE5vZGVzWzFdO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBNYWtlIGEgbmV3IGVtcHR5IEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZSBzdGF0ZSBvYmplY3QuXG4gICAgICogQGRlc2MgVGhpcyBmdW5jdGlvbiBtYWtlcyBhIG5ldyBkZWZhdWx0IHN0YXRlIG9iamVjdCBhcyB1c2VkIGJ5IEh5cGVyZ3JpZCwgYSByb290IHdpdGggZXhhY3RseSB0d28gXCJ0cnVua3MuXCJcbiAgICAgKlxuICAgICAqID4gKipEZWZpbml0aW9uOioqIEEgKnRydW5rKiBpcyBkZWZpbmVkIGFzIGEgY2hpbGQgbm9kZSB3aXRoIGEgdHJ1dGh5IGBrZWVwYCBwcm9wZXJ0eSwgbWFraW5nIHRoaXMgbm9kZSBpbW11bmUgdG8gdGhlIHVzdWFsIHBydW5pbmcgdGhhdCB3b3VsZCBvY2N1ciB3aGVuIGl0IGhhcyBubyBjaGlsZCBub2RlcyBvZiBpdHMgb3duLiBUbyBiZSBhIHRydWUgdHJ1bmssIGFsbCBhbmNlc3RvciBub2RlcyB0byBiZSB0cnVua3MgYXMgd2VsbC4gTm90ZSB0aGF0IHRoZSByb290IGlzIGEgbmF0dXJhbCB0cnVuazsgaXQgZG9lcyBub3QgcmVxdWlyZSBhIGBrZWVwYCBwcm9wZXJ0eS5cbiAgICAgKlxuICAgICAqIFRoZSB0d28gdHJ1bmtzIG9mIHRoZSBIeXBlcmdyaWQgZmlsdGVyIGFyZTpcbiAgICAgKiAqIFRoZSAqKlRhYmxlIEZpbHRlcioqIChsZWZ0IHRydW5rLCBvciBgY2hpbGRyZW5bMF1gKSwgYSBoaWVyYXJjaHkgb2YgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucy5cbiAgICAgKiAqIFRoZSAqKkNvbHVtbiBGaWx0ZXJzKiogKHJpZ2h0IHRydW5rLCBvciBgY2hpbGRyZW5bMV1gKSwgYSBzZXJpZXMgb2Ygc3ViZXhwcmVzc2lvbnMsIG9uZSBwZXIgYWN0aXZlIGNvbHVtbiBmaWx0ZXIuIEVhY2ggc3ViZXhwcmVzc2lvbiBjb250YWlucyBhbnkgbnVtYmVyIG9mIGV4cHJlc3Npb25zIGJvdW5kIHRvIHRoYXQgY29sdW1uIGJ1dCBubyBmdXJ0aGVyIHN1YmV4cHJlc3Npb25zLlxuICAgICAqXG4gICAgICogVGhlIGBvcGVyYXRvcmAgcHJvcGVydGllcyBmb3IgYWxsIHN1YmV4cHJlc3Npb25zIGRlZmF1bHQgdG8gYCdvcC1hbmQnYCwgd2hpY2ggbWVhbnM6XG4gICAgICogKiBBbGwgdGFibGUgZmlsdGVyIGV4cHJlc3Npb25zIGFuZCBzdWJleHByZXNzaW9ucyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIGlzIGp1c3QgdGhlIGRlZmF1bHQgYW5kIG1heSBiZSBjaGFuZ2VkIGZyb20gdGhlIFVJLilcbiAgICAgKiAqIEFsbCBleHByZXNzaW9ucyB3aXRoaW4gYSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBpcyBqdXN0IHRoZSBkZWZhdWx0IGFuZCBtYXkgYmUgY2hhbmdlZCBmcm9tIHRoZSBVSS4pXG4gICAgICogKiBBbGwgY29sdW1uIEZpbHRlcnMgc3ViZXhwcmVzc2lvbnMgYXJlIEFORCdkIHRvZ2V0aGVyLiAoVGhpcyBtYXkgbm90IGJlIGNoYW5nZWQgZnJvbSBVSS4pXG4gICAgICogKiBGaW5hbGx5LCB0aGUgdGFibGUgZmlsdGVyIGFuZCBjb2x1bW4gZmlsdGVycyBhcmUgQU5EJ2QgdG9nZXRoZXIuIChUaGlzIG1heSBub3QgYmUgY2hhbmdlZCBmcm9tIFVJLilcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEEgcGxhaW4gb2JqZWN0IHRvIHNlcnZlIGFzIGEgZmlsdGVyLXRyZWUgc3RhdGUgb2JqZWN0IHJlcHJlc2VudGluZyBhIG5ldyBIeXBlcmdyaWQgZmlsdGVyLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFrZU5ld1Jvb3Q6IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHRoaXMudGFibGVGaWx0ZXIgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyB0YWJsZSBmaWx0ZXIgZXhwcmVzc2lvbnMgYW5kIHN1YmV4cHJlc3Npb25zIGdvIGhlcmVcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnMgPSB7XG4gICAgICAgICAgICBrZWVwOiB0cnVlLFxuICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcnMnLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtcbiAgICAgICAgICAgICAgICAvLyBzdWJleHByZXNzaW9ucyB3aXRoIHR5cGUgJ2NvbHVtbkZpbHRlcicgZ28gaGVyZSwgb25lIGZvciBlYWNoIGFjdGl2ZSBjb2x1bW4gZmlsdGVyXG4gICAgICAgICAgICBdXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGZpbHRlciA9IHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXG4gICAgICAgICAgICAgICAgdGhpcy50YWJsZUZpbHRlcixcbiAgICAgICAgICAgICAgICB0aGlzLmNvbHVtbkZpbHRlcnNcbiAgICAgICAgICAgIF1cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gZmlsdGVyO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgdGhlIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBub2RlLlxuICAgICAqIEBkZXNjIEVhY2ggY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIG5vZGUgaXMgYSBjaGlsZCBub2RlIG9mIHRoZSBgY29sdW1uRmlsdGVyc2AgdHJ1bmsgb2YgdGhlIEh5cGVyZ3JpZCBmaWx0ZXIgdHJlZS5cbiAgICAgKiBFYWNoIHN1Y2ggbm9kZSBjb250YWlucyBhbGwgdGhlIGNvbHVtbiBmaWx0ZXIgZXhwcmVzc2lvbnMgZm9yIHRoZSBuYW1lZCBjb2x1bW4uIEl0IHdpbGwgbmV2ZXIgYmUgZW1wdHk7IGlmIHRoZXJlIGlzIG5vIGNvbHVtbiBmaWx0ZXIgZm9yIHRoZSBuYW1lZCBjb2x1bW4sIGl0IHdvbid0IGV4aXN0IGluIGBjb2x1bW5GaWx0ZXJzYC5cbiAgICAgKlxuICAgICAqIENBVVRJT046IFRoaXMgaXMgdGhlIGFjdHVhbCBub2RlIG9iamVjdC4gRG8gbm90IGNvbmZ1c2UgaXQgd2l0aCB0aGUgY29sdW1uIGZpbHRlciBfc3RhdGVfIG9iamVjdCAoZm9yIHdoaWNoIHNlZSB0aGUge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0Q29sdW1uRmlsdGVyU3RhdGV8Z2V0Q29sdW1uRmlsdGVyU3RhdGUoKX0gbWV0aG9kKS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RGVmYXVsdEZpbHRlcn0gUmV0dXJucyBgdW5kZWZpbmVkYCBpZiB0aGUgY29sdW1uIGZpbHRlciBkb2VzIG5vdCBleGlzdC5cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbk5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sdW1uRmlsdGVycy5jaGlsZHJlbi5maW5kKGZ1bmN0aW9uKGNvbHVtbkZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbkZpbHRlci5jaGlsZHJlbi5sZW5ndGggJiYgY29sdW1uRmlsdGVyLmNoaWxkcmVuWzBdLmNvbHVtbiA9PT0gY29sdW1uTmFtZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gICAgICogU2VlIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdHx0eXBlIGRlZmluaXRpb259IGluIHRoZSBmaWx0ZXItdHJlZSBkb2N1bWVudGF0aW9uLlxuICAgICAqL1xuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3RcbiAgICAgKiBTZWUgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fHR5cGUgZGVmaW5pdGlvbn0gaW4gdGhlIGZpbHRlci10cmVlIGRvY3VtZW50YXRpb24uXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRDb2x1bW5GaWx0ZXJTdGF0ZTogZnVuY3Rpb24ocmF3Q29sdW1uTmFtZSwgb3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSk7XG5cbiAgICAgICAgaWYgKGNvbHVtblNjaGVtYSkge1xuICAgICAgICAgICAgdmFyIHN1YmV4cHJlc3Npb24gPSB0aGlzLmdldENvbHVtbkZpbHRlcihjb2x1bW5TY2hlbWEubmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChzdWJleHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCkpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuc3ludGF4ID0gJ0NRTCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHN1YmV4cHJlc3Npb24uZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAZGVzYyBBZGRzIENRTCBzdXBwb3J0IHRvIHRoaXMuZ2V0U3RhdGUoKS4gVGhpcyBmdW5jdGlvbiB0aHJvd3MgcGFyc2VyIGVycm9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGB0aGlzLnJvb3QuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcmF3Q29sdW1uTmFtZSAtIENvbHVtbiBuYW1lIGZvciBjYXNlIGFuZCBhbGlhcyBsb29rdXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldENvbHVtbkZpbHRlclN0YXRlYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIERlZmF1bHRGaWx0ZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0Q29sdW1uRmlsdGVyU3RhdGU6IGZ1bmN0aW9uKHJhd0NvbHVtbk5hbWUsIHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcixcbiAgICAgICAgICAgIHN1YmV4cHJlc3Npb247XG5cbiAgICAgICAgdmFyIGNvbHVtbk5hbWUgPSB0aGlzLnNjaGVtYS5sb29rdXAocmF3Q29sdW1uTmFtZSkubmFtZTtcblxuICAgICAgICBpZiAoIWNvbHVtbk5hbWUpIHtcbiAgICAgICAgICAgIHRocm93ICdVbmtub3duIGNvbHVtbiBuYW1lIFwiJyArIHJhd0NvbHVtbk5hbWUgKyAnXCInO1xuICAgICAgICB9XG5cbiAgICAgICAgc3ViZXhwcmVzc2lvbiA9IHRoaXMuZ2V0Q29sdW1uRmlsdGVyKGNvbHVtbk5hbWUpO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMpOyAvLyBjbG9uZSBpdCBiZWNhdXNlIHdlIG1heSBtdXRhdGUgaXQgYmVsb3dcbiAgICAgICAgICAgIG9wdGlvbnMuc3ludGF4ID0gb3B0aW9ucy5zeW50YXggfHwgJ0NRTCc7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLnN5bnRheCA9PT0gJ0NRTCcpIHtcbiAgICAgICAgICAgICAgICAvLyBDb252ZXJ0IHNvbWUgQ1FMIHN0YXRlIHN5bnRheCBpbnRvIGEgZmlsdGVyIHRyZWUgc3RhdGUgb2JqZWN0LlxuICAgICAgICAgICAgICAgIC8vIFRoZXJlIG11c3QgYmUgYXQgbGVhc3Qgb25lIGNvbXBsZXRlIGV4cHJlc3Npb24gb3IgYHN0YXRlYCB3aWxsIGJlY29tZSB1bmRlZmluZWQuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnJvb3QucGFyc2VyQ1FMLnBhcnNlKHN0YXRlLCBjb2x1bW5OYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnN5bnRheCA9ICdvYmplY3QnO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ0RlZmF1bHRGaWx0ZXI6IE5vIGNvbXBsZXRlIGV4cHJlc3Npb24uJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yID0gZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZXJyb3IpIHsgLy8gcGFyc2Ugc3VjY2Vzc2Z1bFxuICAgICAgICAgICAgICAgIGlmIChzdWJleHByZXNzaW9uKSB7IC8vIHN1YmV4cHJlc3Npb24gYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVwbGFjZSBzdWJleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGlzIGNvbHVtblxuICAgICAgICAgICAgICAgICAgICBzdWJleHByZXNzaW9uLnNldFN0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgYSBuZXcgc3ViZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhpcyBjb2x1bW5cbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnBhcnNlU3RhdGVTdHJpbmcoc3RhdGUsIG9wdGlvbnMpOyAvLyBiZWNhdXNlIC5hZGQoKSBvbmx5IHRha2VzIG9iamVjdCBzeW50YXhcbiAgICAgICAgICAgICAgICAgICAgc3ViZXhwcmVzc2lvbiA9IHRoaXMuY29sdW1uRmlsdGVycy5hZGQoc3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVycm9yID0gc3ViZXhwcmVzc2lvbi5pbnZhbGlkKG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1YmV4cHJlc3Npb24gJiYgKCFzdGF0ZSB8fCBlcnJvcikpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBzdWJleHByZXNzaW9uIHJlcHJlc2VudGluZyB0aGlzIGNvbHVtblxuICAgICAgICAgICAgc3ViZXhwcmVzc2lvbi5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgR2V0IHN0YXRlIG9mIGFsbCBjb2x1bW4gZmlsdGVycy5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldENvbHVtbkZpbHRlcnNTdGF0ZTogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnN5bnRheCA9PT0gJ0NRTCcpIHtcbiAgICAgICAgICAgIHRocm93ICdUaGUgQ1FMIHN5bnRheCBpcyBpbnRlbmRlZCBmb3IgdXNlIG9uIGEgc2luZ2xlIGNvbHVtbiBmaWx0ZXIgb25seS4gSXQgZG9lcyBub3Qgc3VwcG9ydCBtdWx0aXBsZSBjb2x1bW5zIG9yIHN1YmV4cHJlc3Npb25zLic7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb2x1bW5GaWx0ZXJzLmdldFN0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgc3RhdGUgb2YgYWxsIGNvbHVtbiBmaWx0ZXJzLlxuICAgICAqIEBkZXNjIE5vdGUgdGhhdCB0aGUgY29sdW1uIGZpbHRlcnMgaW1wbGVtZW50YXRpb24gZGVwZW5kcyBvbiB0aGUgbm9kZXMgaGF2aW5nIGNlcnRhaW4gbWV0YS1kYXRhOyB5b3Ugc2hvdWxkIG5vdCBiZSBjYWxsaW5nIHRoaXMgd2l0aG91dCB0aGVzZSBtZXRhLWRhdGEgYmVpbmcgaW4gcGxhY2UuIFNwZWNpZmljYWxseSBgdHlwZSA9ICdjb2x1bW5GaWx0ZXJzJ2AgYW5kICBga2VlcCA9IHRydWVgIGZvciB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSBhbmRgdHlwZSA9ICdjb2x1bW5GaWx0ZXInYCBmb3IgZWFjaCBpbmRpdmlkdWFsIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbi4gSW4gYWRkaXRpb24gdGhlIHN1YnRyZWUgb3BlcmF0b3JzIHNob3VsZCBhbHdheXMgYmUgYCdvcC1hbmQnYC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRDb2x1bW5GaWx0ZXJzU3RhdGU6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcjtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMucm9vdC5jb2x1bW5GaWx0ZXJzLnNldFN0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGVycm9yID0gdGhpcy5yb290LmNvbHVtbkZpbHRlcnMuaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBlcnJvcjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUYWJsZUZpbHRlclN0YXRlOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4ID09PSAnQ1FMJykge1xuICAgICAgICAgICAgdGhyb3cgJ1RoZSBDUUwgc3ludGF4IGlzIGludGVuZGVkIGZvciB1c2Ugb24gYSBzaW5nbGUgY29sdW1uIGZpbHRlciBvbmx5LiBJdCBkb2VzIG5vdCBzdXBwb3J0IG11bHRpcGxlIGNvbHVtbnMgb3Igc3ViZXhwcmVzc2lvbnMuJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yb290LnRhYmxlRmlsdGVyLmdldFN0YXRlKG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RhdGVcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRhYmxlRmlsdGVyU3RhdGU6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBlcnJvcjtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMucm9vdC50YWJsZUZpbHRlci5zZXRTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBlcnJvciA9IHRoaXMucm9vdC50YWJsZUZpbHRlci5pbnZhbGlkKG9wdGlvbnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5yb290LnRhYmxlRmlsdGVyLmNoaWxkcmVuLmxlbmd0aCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIFRoZSBDUUwgc3ludGF4IHNob3VsZCBvbmx5IGJlIHJlcXVlc3RlZCBmb3IgYSBzdWJ0cmVlIGNvbnRhaW5pbmcgaG9tb2dlbmVvdXMgY29sdW1uIG5hbWVzIGFuZCBubyBzdWJleHByZXNzaW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J29iamVjdCddIC0gSWYgYCdDUUwnYCwgd2Fsa3MgdGhlIHRyZWUsIHJldHVybmluZyBhIHN0cmluZyBzdWl0YWJsZSBmb3IgYSBIeXBlcmdyaWQgZmlsdGVyIGNlbGwuIEFsbCBvdGhlciB2YWx1ZXMgYXJlIGZvcndhcmRlZCB0byB0aGUgcHJvdG90eXBlJ3MgYGdldFN0YXRlYCBtZXRob2QgZm9yIGZ1cnRoZXIgaW50ZXJwcmV0YXRpb24uXG4gICAgICpcbiAgICAgKiBOT1RFOiBDUUwgaXMgbm90IGludGVuZGVkIHRvIGJlIHVzZWQgb3V0c2lkZSB0aGUgY29udGV4dCBvZiBhIGBjb2x1bW5GaWx0ZXJzYCBzdWJleHByZXNzaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4O1xuXG4gICAgICAgIGlmIChzeW50YXggPT09ICdDUUwnKSB7XG4gICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSB0aGlzLm9wZXJhdG9yLnN1YnN0cigzKTsgLy8gcmVtb3ZlIHRoZSAnb3AtJyBwcmVmaXhcbiAgICAgICAgICAgIHJlc3VsdCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkLCBpZHgpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgQ3VzdG9tRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlkeCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSAnICcgKyBvcGVyYXRvciArICcgJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSBjaGlsZC5nZXRTdGF0ZShvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRGVmYXVsdEZpbHRlcjogRXhwZWN0ZWQgYSBjb25kaXRpb25hbCBidXQgZm91bmQgYSBzdWJleHByZXNzaW9uLiBTdWJleHByZXNzaW9ucyBhcmUgbm90IHN1cHBvcnRlZCBpbiBDUUwgKENvbHVtbiBRdWVyeSBMYW5ndWFnZSwgdGhlIGZpbHRlciBjZWxsIHN5bnRheCkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IEZpbHRlclRyZWUucHJvdG90eXBlLmdldFN0YXRlLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgTGlzdCBvZiBmaWx0ZXIgcHJvcGVydGllcyB0byBiZSB0cmVhdGVkIGFzIGZpcnN0IGNsYXNzIG9iamVjdHMuXG4gICAgICogQGRlc2MgT24gZmlsdGVyIHByb3BlcnR5IHNldCwgZm9yIGEgcHJvcGVydHkgdmFsdWUgdGhhdCBpcyBhIGZ1bmN0aW9uOlxuICAgICAqICogSWYgbGlzdGVkIGhlcmUsIGZ1bmN0aW9uIGl0IHNlbGYgaXMgYXNzaWduZWQgdG8gcHJvcGVydHkuXG4gICAgICogKiBJZiBfbm90XyBsaXN0ZWQgaGVyZSwgZnVuY3Rpb24gd2lsbCBiZSBleGVjdXRlZCB0byBnZXQgdmFsdWUgdG8gYXNzaWduIHRvIHByb3BlcnR5LlxuICAgICAqIEBtZW1iZXJPZiBEZWZhdWx0RmlsdGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpcnN0Q2xhc3NQcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNhbGN1bGF0b3I6IHRydWVcbiAgICB9LFxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbHVtbkZpbHRlcnMuY2hpbGRyZW4ubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgdGhpcy50YWJsZUZpbHRlci5jaGlsZHJlbi5sZW5ndGggPiAwO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAaW1wbGVtZW50cyBkYXRhQ29udHJvbEludGVyZmFjZSNwcm9wZXJ0aWVzXG4gICAgICogQGRlc2MgTm90ZXMgcmVnYXJkaW5nIHNwZWNpZmljIHByb3BlcnRpZXM6XG4gICAgICogKiBgY2FzZVNlbnNpdGl2ZURhdGFgIChyb290IHByb3BlcnR5KSBwZXJ0YWlucyB0byBzdHJpbmcgY29tcGFyZXMgb25seS4gVGhpcyBpbmNsdWRlcyB1bnR5cGVkIGNvbHVtbnMsIGNvbHVtbnMgdHlwZWQgYXMgc3RyaW5ncywgdHlwZWQgY29sdW1ucyBjb250YWluaW5nIGRhdGEgdGhhdCBjYW5ub3QgYmUgY29lcmNlZCB0byB0eXBlIG9yIHdoZW4gdGhlIGZpbHRlciBleHByZXNzaW9uIG9wZXJhbmQgY2Fubm90IGJlIGNvZXJjZWQuIFRoaXMgaXMgYSBzaGFyZWQgcHJvcGVydHkgYW5kIGFmZmVjdHMgYWxsIGdyaWRzIG1hbmFnZWQgYnkgdGhpcyBpbnN0YW5jZSBvZiB0aGUgYXBwLlxuICAgICAqICogYGNhbGN1bGF0b3JgIChjb2x1bW4gcHJvcGVydHkpIENvbXB1dGVkIGNvbHVtbiBjYWxjdWxhdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMgT25lIG9mOlxuICAgICAqICogKipHZXR0ZXIqKiB0eXBlIGNhbGw6IFZhbHVlIG9mIHJlcXVlc3RlZCBwcm9wZXJ0eSBvciBgbnVsbGAgaWYgdW5kZWZpbmVkLlxuICAgICAqICogKipTZXR0ZXIqKiB0eXBlIGNhbGw6IGB1bmRlZmluZWRgXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRGVmYXVsdEZpbHRlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBwcm9wZXJ0aWVzOiBmdW5jdGlvbihwcm9wZXJ0aWVzKSB7XG4gICAgICAgIHZhciByZXN1bHQsIHZhbHVlLFxuICAgICAgICAgICAgb2JqZWN0ID0gcHJvcGVydGllcyAmJiBwcm9wZXJ0aWVzLkNPTFVNTlxuICAgICAgICAgICAgICAgID8gdGhpcy5zY2hlbWEubG9va3VwKHByb3BlcnRpZXMuQ09MVU1OLm5hbWUpXG4gICAgICAgICAgICAgICAgOiB0aGlzLnJvb3Q7XG5cbiAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5HRVRURVIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBvYmplY3RbYWxpYXMocHJvcGVydGllcy5HRVRURVIpXTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydGllc1trZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmICF0aGlzLmZpcnN0Q2xhc3NQcm9wZXJ0aWVzW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFthbGlhcyhrZXkpXSA9IHZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvYmplY3RbYWxpYXMoa2V5KV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufSk7XG5cbmZ1bmN0aW9uIGFsaWFzKGtleSkge1xuICAgIGlmIChrZXkgPT09ICdoZWFkZXInKSB7XG4gICAgICAgIGtleSA9ICdhbGlhcyc7XG4gICAgfVxuICAgIHJldHVybiBrZXk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBEZWZhdWx0RmlsdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEBpbXBsZW1lbnRzIGRhdGFNb2RlbEFQSVxuICogQHBhcmFtIHtIeXBlcmdyaWR9IGdyaWRcbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5uYW1lXVxuICogQGNvbnN0cnVjdG9yXG4gKi9cbmZ1bmN0aW9uIEZpbHRlclN1YmdyaWQoZ3JpZCwgb3B0aW9ucykge1xuICAgIHRoaXMuZ3JpZCA9IGdyaWQ7XG4gICAgdGhpcy5iZWhhdmlvciA9IGdyaWQuYmVoYXZpb3I7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7ZGF0YVJvd09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmRhdGFSb3cgPSB7fTsgLy8gZm9yIG1ldGEgZGF0YSAoX19IRUlHSFQpXG5cbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm5hbWUpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIH1cbn1cblxuRmlsdGVyU3ViZ3JpZC5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IEZpbHRlclN1YmdyaWQucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuXG4gICAgdHlwZTogJ2ZpbHRlcicsXG5cbiAgICBmb3JtYXQ6ICdmaWx0ZXInLCAvLyBvdmVycmlkZSBjb2x1bW4gZm9ybWF0XG5cbiAgICBnZXRSb3dDb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdyaWQucHJvcGVydGllcy5zaG93RmlsdGVyUm93ID8gMSA6IDA7XG4gICAgfSxcblxuICAgIGdldFZhbHVlOiBmdW5jdGlvbih4LCB5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yLmRhdGFNb2RlbC5nZXRGaWx0ZXIoeCkgfHwgJyc7XG4gICAgfSxcblxuICAgIHNldFZhbHVlOiBmdW5jdGlvbih4LCB5LCB2YWx1ZSkge1xuICAgICAgICB0aGlzLmJlaGF2aW9yLmRhdGFNb2RlbC5zZXRGaWx0ZXIoeCwgdmFsdWUpO1xuICAgIH0sXG5cbiAgICBnZXRSb3c6IGZ1bmN0aW9uKHkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVJvdztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlclN1YmdyaWQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xuXG52YXIgUkVHRVhQX0JPT0xTID0gL1xcYihBTkR8T1J8Tk9SKVxcYi9naSxcbiAgICBFWFAgPSAnKC4qPyknLCBCUiA9ICdcXFxcYicsXG4gICAgUFJFRklYID0gJ14nICsgRVhQICsgQlIsXG4gICAgSU5GSVggPSBCUiArIEVYUCArIEJSLFxuICAgIFBPU1RGSVggPSBCUiArIEVYUCArICckJztcblxuZnVuY3Rpb24gUGFyc2VyQ3FsRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5QYXJzZXJDcWxFcnJvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEVycm9yLnByb3RvdHlwZSk7XG5QYXJzZXJDcWxFcnJvci5wcm90b3R5cGUubmFtZSA9ICdQYXJzZXJDcWxFcnJvcic7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHN1bW1hcnkgQ29sdW1uIFF1ZXJ5IExhbmd1YWdlIChDUUwpIHBhcnNlclxuICpcbiAqIEBhdXRob3IgSm9uYXRoYW4gRWl0ZW4gam9uYXRoYW5Ab3BlbmZpbi5jb21cbiAqXG4gKiBAZGVzYyBTZWUge0B0dXRvcmlhbCBDUUx9IGZvciB0aGUgZ3JhbW1hci5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gb3BlcmF0b3JzSGFzaCAtIEhhc2ggb2YgdmFsaWQgb3BlcmF0b3JzLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHttZW51SXRlbVtdfSBbb3B0aW9ucy5zY2hlbWFdIC0gQ29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIG5hbWUvYWxpYXMgdmFsaWRhdGlvbi4gVGhyb3dzIGFuIGVycm9yIGlmIG5hbWUgZmFpbHMgdmFsaWRhdGlvbiAoYnV0IHNlZSBgcmVzb2x2ZUFsaWFzZXNgKS4gT21pdCB0byBza2lwIGNvbHVtbiBuYW1lIHZhbGlkYXRpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlZmF1bHRPcD0nPSddIC0gRGVmYXVsdCBvcGVyYXRvciBmb3IgY29sdW1uIHdoZW4gbm90IGRlZmluZWQgaW4gY29sdW1uIHNjaGVtYS5cbiAqL1xuZnVuY3Rpb24gUGFyc2VyQ1FMKG9wZXJhdG9yc0hhc2gsIG9wdGlvbnMpIHtcbiAgICB2YXIgb3BlcmF0b3JzID0gW107XG5cbiAgICB0aGlzLnNjaGVtYSA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zY2hlbWE7XG4gICAgdGhpcy5kZWZhdWx0T3AgPSAob3B0aW9ucyAmJiBvcHRpb25zLmRlZmF1bHRPcCB8fCAnPScpLnRvVXBwZXJDYXNlKCk7XG5cbiAgICBfKG9wZXJhdG9yc0hhc2gpLmVhY2goZnVuY3Rpb24ocHJvcHMsIG9wKSB7XG4gICAgICAgIGlmIChvcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9wZXJhdG9ycy5wdXNoKG9wKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gUHV0IGxhcmdlciBvbmVzIGZpcnN0IHNvIHRoYXQgaW4gY2FzZSBhIHNtYWxsZXIgb25lIGlzIGEgc3Vic3RyaW5nIG9mIGEgbGFyZ2VyIG9uZSAoc3VjaCBhcyAnPCcgaXMgdG8gJzw9JyksIGxhcmdlciBvbmUgd2lsbCBiZSBtYXRjaGVkIGZpcnN0LlxuICAgIG9wZXJhdG9ycyA9IG9wZXJhdG9ycy5zb3J0KGRlc2NlbmRpbmdCeUxlbmd0aCk7XG5cbiAgICAvLyBFc2NhcGUgYWxsIHN5bWJvbGljIChub24gYWxwaGEpIG9wZXJhdG9ycy5cbiAgICBvcGVyYXRvcnMgPSBvcGVyYXRvcnMubWFwKGZ1bmN0aW9uKG9wKSB7XG4gICAgICAgIGlmICgvXlteQS1aXS8udGVzdChvcCkpIHtcbiAgICAgICAgICAgIG9wID0gJ1xcXFwnICsgb3Auc3BsaXQoJycpLmpvaW4oJ1xcXFwnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3A7XG4gICAgfSk7XG5cbiAgICB2YXIgc3ltYm9saWNPcGVyYXRvcnMgPSBvcGVyYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKG9wKSB7IHJldHVybiBvcFswXSA9PT0gJ1xcXFwnOyB9KSxcbiAgICAgICAgYWxwaGFPcGVyYXRvcnMgPSBvcGVyYXRvcnMuZmlsdGVyKGZ1bmN0aW9uKG9wKSB7IHJldHVybiBvcFswXSAhPT0gJ1xcXFwnOyB9KS5qb2luKCd8Jyk7XG5cbiAgICBpZiAoYWxwaGFPcGVyYXRvcnMpIHtcbiAgICAgICAgYWxwaGFPcGVyYXRvcnMgPSAnXFxcXGIoJyArIGFscGhhT3BlcmF0b3JzICsgJylcXFxcYic7XG4gICAgfVxuICAgIC8qKiBAc3VtbWFyeSBSZWdleCB0byBtYXRjaCBhbnkgb3BlcmF0b3IuXG4gICAgICogQGRlc2MgTWF0Y2hlcyBzeW1ib2xpYyBvcGVyYXRvcnMgKG1hZGUgdXAgb2Ygbm9uLWFscGhhIGNoYXJhY3RlcnMpIG9yIGlkZW50aWZpZXIgb3BlcmF0b3JzICh3b3JkLWJvdW5kYXJ5LWlzb2xhdGVkIHJ1bnMgb2YgYWxwaGFudW1lcmljIGNoYXJhY3RlcnMpLlxuICAgICAqIEB0eXBlIHtSZWdFeHB9XG4gICAgICovXG4gICAgdGhpcy5SRUdFWF9PUEVSQVRPUiA9IG5ldyBSZWdFeHAoc3ltYm9saWNPcGVyYXRvcnMuY29uY2F0KGFscGhhT3BlcmF0b3JzKS5qb2luKCd8JyksICdpZycpO1xuXG4gICAgb3BlcmF0b3JzID0gb3BlcmF0b3JzLmpvaW4oJ3wnKSAvLyBwaXBlIHRoZW1cbiAgICAgICAgLnJlcGxhY2UoL1xccysvZywgJ1xcXFxzKycpOyAvLyBhcmJpdHJhcnkgc3RyaW5nIG9mIHdoaXRlc3BhY2UgY2hhcnMgLT4gd2hpdGVzcGFjZSByZWdleCBtYXRjaGVyXG5cbiAgICAvKiogQHN1bW1hcnkgUmVnZXggdG8gbWF0Y2ggYW4gb3BlcmF0b3IgKyBvcHRpb25hbCBvcGVyYXRvclxuICAgICAqIEBkZXNjIFRIZSBvcGVyYXRvciBpcyBvcHRpb25hbC4gVGhlIG9wZXJhbmQgbWF5IChvciBtYXkgbm90KSBiZSBlbmNsb3NlZCBpbiBwYXJlbnRoZXNlcy5cbiAgICAgKiBAZGVzYyBNYXRjaCBsaXN0OlxuICAgICAqIDAuIF9pbnB1dCBzdHJpbmdfXG4gICAgICogMS4gb3BlcmF0b3JcbiAgICAgKiAyLiBvdXRlciBvcGVyYW5kIChtYXkgaW5jbHVkZSBwYXJlbnRoZXNlcylcbiAgICAgKiAzLiBpbm5lciBvcGVyYW5kIHdpdGhvdXQgcGFyZW50aGVzZXMgKHdoZW4gYW4gb3BlcmFuZCB3YXMgZ2l2ZW4gd2l0aCBwYXJlbnRoZXNlcylcbiAgICAgKiA0LiBpbm5lciBvcGVyYW5kICh3aGVuIGFuIG9wZXJhbmQgd2FzIGdpdmVuIHdpdGhvdXQgcGFyZW50aGVzZXMpXG4gICAgICogQHR5cGUge1JlZ0V4cH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBtZW1iZXJPZiBQYXJzZXJDUUwucHJvdG90eXBlXG4gICAgICovXG4gICAgdGhpcy5SRUdFWF9FWFBSRVNTSU9OID0gbmV3IFJlZ0V4cCgnXlxcXFxzKignICsgb3BlcmF0b3JzICsgJyk/XFxcXHMqKFxcXFwoXFxcXHMqKC4rPylcXFxccypcXFxcKXwoLis/KSlcXFxccyokJywgJ2knKTtcblxuICAgIHRoaXMuUkVHRVhfTElURVJBTF9UT0tFTlMgPSBuZXcgUmVnRXhwKCdcXFxcJyArIFBhcnNlckNRTC5xdCArICcoXFxcXGQrKScgKyAnXFxcXCcgKyBQYXJzZXJDUUwucXQsICdnJyk7XG5cbn1cblxuLyoqIEBzdW1tYXJ5IE9wZXJhbmQgcXVvdGF0aW9uIG1hcmsgY2hhcmFjdGVyLlxuICogQGRlc2MgU2hvdWxkIGJlIGEgc2luZ2xlIGNoYXJhY3RlciAobGVuZ3RoID09PSAxKS5cbiAqIEBkZWZhdWx0ICdcIidcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblBhcnNlckNRTC5xdCA9ICdcIic7XG5cblBhcnNlckNRTC5wcm90b3R5cGUgPSB7XG5cbiAgICBjb25zdHJ1Y3RvcjogUGFyc2VyQ1FMLnByb3RvdHlwZS5jb25zdHJ1Y3RvcixcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEV4dHJhY3QgdGhlIGJvb2xlYW4gb3BlcmF0b3JzIGZyb20gYW4gZXhwcmVzc2lvbiBjaGFpbi5cbiAgICAgKiBAZGVzYyBSZXR1cm5zIGxpc3Qgb2YgaG9tb2dlbmVvdXMgb3BlcmF0b3JzIHRyYW5zZm9ybWVkIHRvIGxvd2VyIGNhc2UuXG4gICAgICpcbiAgICAgKiBUaHJvd3MgYW4gZXJyb3IgaWYgYWxsIHRoZSBib29sZWFuIG9wZXJhdG9ycyBpbiB0aGUgY2hhaW4gYXJlIG5vdCBpZGVudGljYWwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNxbFxuICAgICAqIEByZXR1cm5zIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBjYXB0dXJlQm9vbGVhbnM6IGZ1bmN0aW9uKGNxbCkge1xuICAgICAgICB2YXIgYm9vbGVhbnMgPSBjcWwubWF0Y2goUkVHRVhQX0JPT0xTKTtcbiAgICAgICAgcmV0dXJuIGJvb2xlYW5zICYmIGJvb2xlYW5zLm1hcChmdW5jdGlvbihib29sKSB7XG4gICAgICAgICAgICByZXR1cm4gYm9vbC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgdmFsaWRhdGVCb29sZWFuczogZnVuY3Rpb24oYm9vbGVhbnMpIHtcbiAgICAgICAgaWYgKGJvb2xlYW5zKSB7XG4gICAgICAgICAgICB2YXIgaGV0ZXJvZ2VuZW91c09wZXJhdG9yID0gYm9vbGVhbnMuZmluZChmdW5jdGlvbihvcCwgaSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBib29sZWFuc1tpXSAhPT0gYm9vbGVhbnNbMF07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKGhldGVyb2dlbmVvdXNPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJDcWxFcnJvcignRXhwZWN0ZWQgaG9tb2dlbmVvdXMgYm9vbGVhbiBvcGVyYXRvcnMuIFlvdSBjYW5ub3QgbWl4IEFORCwgT1IsIGFuZCBOT1Igb3BlcmF0b3JzIGhlcmUgYmVjYXVzZSB0aGUgb3JkZXIgb2Ygb3BlcmF0aW9ucyBpcyBhbWJpZ3VvdXMuXFxuVGlwOiBJbiBNYW5hZ2UgRmlsdGVycywgeW91IGNhbiBncm91cCBvcGVyYXRpb25zIHdpdGggc3ViZXhwcmVzc2lvbnMgaW4gdGhlIFF1ZXJ5IEJ1aWxkZXIgdGFiIG9yIGJ5IHVzaW5nIHBhcmVudGhlc2VzIGluIHRoZSBTUUwgdGFiLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBib29sZWFucztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQnJlYWsgYW4gZXhwcmVzc2lvbiBjaGFpbiBpbnRvIGEgbGlzdCBvZiBleHByZXNzaW9ucy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY3FsXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gYm9vbGVhbnNcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119XG4gICAgICovXG4gICAgY2FwdHVyZUV4cHJlc3Npb25zOiBmdW5jdGlvbihjcWwsIGJvb2xlYW5zKSB7XG4gICAgICAgIHZhciBleHByZXNzaW9ucywgcmU7XG5cbiAgICAgICAgaWYgKGJvb2xlYW5zKSB7XG4gICAgICAgICAgICByZSA9IG5ldyBSZWdFeHAoUFJFRklYICsgYm9vbGVhbnMuam9pbihJTkZJWCkgKyBQT1NURklYLCAnaScpO1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMgPSBjcWwubWF0Y2gocmUpO1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMuc2hpZnQoKTsgLy8gZGlzY2FyZCBbMF0gKGlucHV0KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwcmVzc2lvbnMgPSBbY3FsXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBleHByZXNzaW9ucztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgTWFrZSBhIGxpc3Qgb2YgY2hpbGRyZW4gb3V0IG9mIGEgbGlzdCBvZiBleHByZXNzaW9ucy5cbiAgICAgKiBAZGVzYyBVc2VzIG9ubHkgX2NvbXBsZXRlXyBleHByZXNzaW9ucyAoYSB2YWx1ZSBPUiBhbiBvcGVyYXRvciArIGEgdmFsdWUpLlxuICAgICAqXG4gICAgICogSWdub3JlcyBfaW5jb21wbGV0ZV8gZXhwcmVzc2lvbnMgKGVtcHR5IHN0cmluZyBPUiBhbiBvcGVyYXRvciAtIGEgdmFsdWUpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBleHByZXNzaW9uc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGxpdGVyYWxzIC0gbGlzdCBvZiBsaXRlcmFscyBpbmRleGVkIGJ5IHRva2VuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7ZXhwcmVzc2lvblN0YXRlW119IHdoZXJlIGBleHByZXNzaW9uU3RhdGVgIGlzIG9uZSBvZjpcbiAgICAgKiAqIGB7Y29sdW1uOiBzdHJpbmcsIG9wZXJhdG9yOiBzdHJpbmcsIG9wZXJhbmQ6IHN0cmluZ31gXG4gICAgICogKiBge2NvbHVtbjogc3RyaW5nLCBvcGVyYXRvcjogc3RyaW5nLCBvcGVyYW5kOiBzdHJpbmcsIGVkaXRvcjogJ0NvbHVtbnMnfWBcbiAgICAgKi9cbiAgICBtYWtlQ2hpbGRyZW46IGZ1bmN0aW9uKGNvbHVtbk5hbWUsIGV4cHJlc3Npb25zLCBsaXRlcmFscykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHJldHVybiBleHByZXNzaW9ucy5yZWR1Y2UoZnVuY3Rpb24oY2hpbGRyZW4sIGV4cCkge1xuICAgICAgICAgICAgaWYgKGV4cCkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJ0cyA9IGV4cC5tYXRjaChzZWxmLlJFR0VYX0VYUFJFU1NJT04pO1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0cykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3AgPSBwYXJ0c1sxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dGVyTGl0ZXJhbCA9IHBhcnRzWzJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJMaXRlcmFsID0gcGFydHMuc2xpY2UoMykuZmluZChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcnQgIT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIG9wID0gKG9wIHx8ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhcmVudGhlc2l6ZWQgPSAvXlxcKC4qXFwpJC8udGVzdChvdXRlckxpdGVyYWwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJPcGVyYXRvcnMgPSBpbm5lckxpdGVyYWwubWF0Y2goc2VsZi5SRUdFWF9PUEVSQVRPUik7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFwYXJlbnRoZXNpemVkICYmIGlubmVyT3BlcmF0b3JzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAob3AgPT09ICcnICYmIG91dGVyTGl0ZXJhbCA9PT0gaW5uZXJPcGVyYXRvcnNbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyQ3FsRXJyb3IoJ0V4cGVjdGVkIGFuIG9wZXJhbmQuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJDcWxFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRXhwZWN0ZWQgb3BlcmFuZCBidXQgZm91bmQgYWRkaXRpb25hbCBvcGVyYXRvcihzKTogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5uZXJPcGVyYXRvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRvU3RyaW5nKCkgLy8gY29udmVydCB0byBjb21tYS1zZXBhcmF0ZWQgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAudG9VcHBlckNhc2UoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvLC9nLCAnLCAnKSAvLyBhZGQgc3BhY2VzIGFmdGVyIHRoZSBjb21tYXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL14oW14sXSspLCAoW14sXSspJC8sICckMSBhbmQgJDInKSAvLyByZXBsYWNlIG9ubHkgY29tbWEgd2l0aCBcImFuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oLissLispLCAoW14sXSspJC8sICckMSwgYW5kICQyJykgLy8gYWRkIFwiYW5kXCIgYWZ0ZXIgbGFzdCBvZiBzZXZlcmFsIGNvbW1hc1xuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wID0gb3AgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2NoZW1hICYmIHNlbGYuc2NoZW1hLmxvb2t1cChjb2x1bW5OYW1lKS5kZWZhdWx0T3AgfHwgLy8gY29sdW1uJ3MgZGVmYXVsdCBvcGVyYXRvciBmcm9tIHNjaGVtYVxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5kZWZhdWx0T3A7IC8vIGdyaWQncyBkZWZhdWx0IG9wZXJhdG9yXG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBjb2x1bW5OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3BlcmF0b3I6IG9wXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGZpZWxkTmFtZSA9IHNlbGYuc2NoZW1hICYmIHNlbGYuc2NoZW1hLmxvb2t1cChpbm5lckxpdGVyYWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGROYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5vcGVyYW5kID0gZmllbGROYW1lLm5hbWUgfHwgZmllbGROYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQuZWRpdG9yID0gJ0NvbHVtbnMnO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBhbmQgZXhwYW5kIGFsbCBjb2xsYXBzZWQgbGl0ZXJhbHMuXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5vcGVyYW5kID0gaW5uZXJMaXRlcmFsLnJlcGxhY2Uoc2VsZi5SRUdFWF9MSVRFUkFMX1RPS0VOUywgZnVuY3Rpb24obWF0Y2gsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGxpdGVyYWxzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBbXSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFRoZSBwb3NpdGlvbiBvZiB0aGUgb3BlcmF0b3Igb2YgdGhlIGV4cHJlc3Npb24gdW5kZXIgdGhlIGN1cnNvci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY3FsIC0gQ1FMIGV4cHJlc3Npb24gdW5kZXIgY29uc3RydWN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdXJzb3IgLSBDdXJyZW50IGN1cnNvcidzIHN0YXJ0aW5nIHBvc2l0aW9uIChgaW5wdXQuc3RhcnRTZWxlY3Rpb25gKVxuICAgICAqIEByZXR1cm5zIHt7c3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXJ9fVxuICAgICAqL1xuICAgIGdldE9wZXJhdG9yUG9zaXRpb246IGZ1bmN0aW9uKGNxbCwgY3Vyc29yKSB7XG4gICAgICAgIC8vIGZpcnN0IHRva2VuaXplIGxpdGVyYWxzIGluIGNhc2UgdGhleSBjb250YWluIGJvb2xlYW5zLi4uXG4gICAgICAgIHZhciBsaXRlcmFscyA9IFtdO1xuICAgICAgICBjcWwgPSB0b2tlbml6ZUxpdGVyYWxzKGNxbCwgUGFyc2VyQ1FMLnF0LCBsaXRlcmFscyk7XG5cbiAgICAgICAgLy8gLi4udGhlbiBleHBhbmQgdG9rZW5zIGJ1dCB3aXRoIHgncyBqdXN0IGZvciBsZW5ndGhcbiAgICAgICAgY3FsID0gY3FsLnJlcGxhY2UodGhpcy5SRUdFWF9MSVRFUkFMX1RPS0VOUywgZnVuY3Rpb24obWF0Y2gsIGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgbGVuZ3RoID0gMSArIGxpdGVyYWxzW2luZGV4XS5sZW5ndGggKyAxOyAvLyBhZGQgcXVvdGUgY2hhcnNcbiAgICAgICAgICAgIHJldHVybiBBcnJheShsZW5ndGggKyAxKS5qb2luKCd4Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBib29sZWFucywgZXhwcmVzc2lvbnMsIHBvc2l0aW9uLCB0YWJzLCBlbmQsIHRhYiwgZXhwcmVzc2lvbiwgb2xkT3BlcmF0b3IsIG9sZE9wZXJhdG9yT2Zmc2V0O1xuXG4gICAgICAgIGlmICgoYm9vbGVhbnMgPSB0aGlzLmNhcHR1cmVCb29sZWFucyhjcWwpKSkge1xuICAgICAgICAgICAgLy8gYm9vbGVhbihzKSBmb3VuZCBzbyBjb25jYXRlbmF0ZWQgZXhwcmVzc2lvbnNcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gdGhpcy5jYXB0dXJlRXhwcmVzc2lvbnMoY3FsLCBib29sZWFucyk7XG4gICAgICAgICAgICBwb3NpdGlvbiA9IDA7XG4gICAgICAgICAgICB0YWJzID0gZXhwcmVzc2lvbnMubWFwKGZ1bmN0aW9uKGV4cHIsIGlkeCkgeyAvLyBnZXQgc3RhcnRpbmcgcG9zaXRpb24gb2YgZWFjaCBleHByZXNzaW9uXG4gICAgICAgICAgICAgICAgdmFyIGJvb2wgPSBib29sZWFuc1tpZHggLSAxXSB8fCAnJztcbiAgICAgICAgICAgICAgICBwb3NpdGlvbiArPSBleHByLmxlbmd0aCArIGJvb2wubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3NpdGlvbjtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBmaW5kIGJlZ2lubmluZyBvZiBleHByZXNzaW9uIHVuZGVyIGN1cnNvciBwb3NpdGlvblxuICAgICAgICAgICAgdGFicy5maW5kKGZ1bmN0aW9uKHRpY2ssIGlkeCkge1xuICAgICAgICAgICAgICAgIHRhYiA9IGlkeDtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3Vyc29yIDw9IHRpY2s7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY3Vyc29yID0gdGFic1t0YWIgLSAxXSB8fCAwO1xuICAgICAgICAgICAgZW5kID0gY3Vyc29yICs9IChib29sZWFuc1t0YWIgLSAxXSB8fCAnJykubGVuZ3RoO1xuXG4gICAgICAgICAgICBleHByZXNzaW9uID0gZXhwcmVzc2lvbnNbdGFiXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGJvb2xlYW5zIG5vdCBmb3VuZCBzbyBzaW5nbGUgZXhwcmVzc2lvblxuICAgICAgICAgICAgY3Vyc29yID0gMDtcbiAgICAgICAgICAgIGVuZCA9IGNxbC5sZW5ndGg7XG4gICAgICAgICAgICBleHByZXNzaW9uID0gY3FsO1xuICAgICAgICB9XG5cbiAgICAgICAgb2xkT3BlcmF0b3JPZmZzZXQgPSBleHByZXNzaW9uLnNlYXJjaCh0aGlzLlJFR0VYX09QRVJBVE9SKTtcbiAgICAgICAgaWYgKG9sZE9wZXJhdG9yT2Zmc2V0ID49IDApIHtcbiAgICAgICAgICAgIG9sZE9wZXJhdG9yID0gZXhwcmVzc2lvbi5tYXRjaCh0aGlzLlJFR0VYX09QRVJBVE9SKVswXTtcbiAgICAgICAgICAgIGN1cnNvciArPSBvbGRPcGVyYXRvck9mZnNldDtcbiAgICAgICAgICAgIGVuZCA9IGN1cnNvciArIG9sZE9wZXJhdG9yLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGFydDogY3Vyc29yLFxuICAgICAgICAgICAgZW5kOiBlbmRcbiAgICAgICAgfTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgTWFrZSBhIFwibG9ja2VkXCIgc3ViZXhwcmVzc2lvbiBkZWZpbml0aW9uIG9iamVjdCBmcm9tIGFuIGV4cHJlc3Npb24gY2hhaW4uXG4gICAgICogQGRlc2MgX0xvY2tlZF8gbWVhbnMgaXQgaXMgbG9ja2VkIHRvIGEgc2luZ2xlIGZpZWxkLlxuICAgICAqXG4gICAgICogV2hlbiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGV4cHJlc3Npb24gaW4gdGhlIGNoYWluLCB0aGUgYG9wZXJhdG9yYCBpcyBvbWl0dGVkIChkZWZhdWx0cyB0byBgJ29wLWFuZCdgKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjcWwgLSBBIGNvbXBvdW5kIENRTCBleHByZXNzaW9uLCBjb25zaXN0aW5nIG9mIG9uZSBvciBtb3JlIHNpbXBsZSBleHByZXNzaW9ucyBhbGwgc2VwYXJhdGVkIGJ5IHRoZSBzYW1lIGxvZ2ljYWwgb3BlcmF0b3IpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbHVtbk5hbWVcblxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8e29wZXJhdG9yOiBzdHJpbmcsIGNoaWxkcmVuOiBzdHJpbmdbXSwgc2NoZW1hOiBzdHJpbmdbXX19XG4gICAgICogYHVuZGVmaW5lZGAgd2hlbiB0aGVyZSBhcmUgbm8gY29tcGxldGUgZXhwcmVzc2lvbnNcbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBtb2R1bGU6Q1FMXG4gICAgICovXG4gICAgcGFyc2U6IGZ1bmN0aW9uKGNxbCwgY29sdW1uTmFtZSkge1xuICAgICAgICAvLyByZWR1Y2UgYWxsIHJ1bnMgb2Ygd2hpdGUgc3BhY2UgdG8gYSBzaW5nbGUgc3BhY2U7IHRoZW4gdHJpbVxuICAgICAgICBjcWwgPSBjcWwucmVwbGFjZSgvXFxzXFxzKy9nLCAnICcpLnRyaW0oKTtcblxuICAgICAgICB2YXIgbGl0ZXJhbHMgPSBbXTtcbiAgICAgICAgY3FsID0gdG9rZW5pemVMaXRlcmFscyhjcWwsIFBhcnNlckNRTC5xdCwgbGl0ZXJhbHMpO1xuXG4gICAgICAgIHZhciBib29sZWFucyA9IHRoaXMudmFsaWRhdGVCb29sZWFucyh0aGlzLmNhcHR1cmVCb29sZWFucyhjcWwpKSxcbiAgICAgICAgICAgIGV4cHJlc3Npb25zID0gdGhpcy5jYXB0dXJlRXhwcmVzc2lvbnMoY3FsLCBib29sZWFucyksXG4gICAgICAgICAgICBjaGlsZHJlbiA9IHRoaXMubWFrZUNoaWxkcmVuKGNvbHVtbk5hbWUsIGV4cHJlc3Npb25zLCBsaXRlcmFscyksXG4gICAgICAgICAgICBvcGVyYXRvciA9IGJvb2xlYW5zICYmIGJvb2xlYW5zWzBdLFxuICAgICAgICAgICAgc3RhdGU7XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICAgICAgc3RhdGUgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2NvbHVtbkZpbHRlcicsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IGNoaWxkcmVuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAob3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZS5vcGVyYXRvciA9ICdvcC0nICsgb3BlcmF0b3I7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gZGVzY2VuZGluZ0J5TGVuZ3RoKGEsIGIpIHtcbiAgICByZXR1cm4gYi5sZW5ndGggLSBhLmxlbmd0aDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDb2xsYXBzZSBsaXRlcmFscy5cbiAqIEBkZXNjIEFsbG93cyByZXNlcnZlZCB3b3JkcyB0byBleGlzdCBpbnNpZGUgYSBxdW90ZWQgc3RyaW5nLlxuICogTGl0ZXJhbHMgYXJlIGNvbGxhcHNlZCB0byBhIHF1b3RlZCBudW1lcmljYWwgaW5kZXggaW50byB0aGUgYGxpdGVyYWxzYCBhcnJheS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gcXRcbiAqIEBwYXJhbSB7c3RyaW5nW119IGxpdGVyYWxzIC0gRW1wdHkgYXJyYXkgaW4gd2hpY2ggdG8gcmV0dXJuIGV4dHJhY3RlZCBsaXRlcmFscy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9XG4gKiBAbWVtYmVyT2YgUGFyc2VyQ1FMXG4gKiBAaW5uZXJcbiAqL1xuZnVuY3Rpb24gdG9rZW5pemVMaXRlcmFscyh0ZXh0LCBxdCwgbGl0ZXJhbHMpIHtcbiAgICBsaXRlcmFscy5sZW5ndGggPSAwO1xuXG4gICAgZm9yIChcbiAgICAgICAgdmFyIGkgPSAwLCBqID0gMCwgaywgaW5uZXJMaXRlcmFsO1xuICAgICAgICAoaiA9IHRleHQuaW5kZXhPZihxdCwgaikpID49IDA7XG4gICAgICAgIGogKz0gMSArIChpICsgJycpLmxlbmd0aCArIDEsIGkrK1xuICAgICkge1xuICAgICAgICBrID0gajtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgayA9IHRleHQuaW5kZXhPZihxdCwgayArIDEpO1xuICAgICAgICAgICAgaWYgKGsgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlckNxbEVycm9yKCdRdW90YXRpb24gbWFya3MgbXVzdCBiZSBwYWlyZWQ7IG5lc3RlZCBxdW90YXRpb24gbWFya3MgbXVzdCBiZSBkb3VibGVkLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IHdoaWxlICh0ZXh0Wysra10gPT09IHF0KTtcblxuICAgICAgICBpbm5lckxpdGVyYWwgPSB0ZXh0XG4gICAgICAgICAgICAuc2xpY2UoKytqLCAtLWspIC8vIGV4dHJhY3RcbiAgICAgICAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAocXQgKyBxdCwgJ2cnKSwgcXQpOyAvLyB1bmVzY2FwZSBlc2NhcGVkIHF1b3RhdGlvbiBtYXJrc1xuXG4gICAgICAgIGxpdGVyYWxzLnB1c2goaW5uZXJMaXRlcmFsKTtcblxuICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHIoMCwgaikgKyBpICsgdGV4dC5zdWJzdHIoayk7IC8vIGNvbGxhcHNlXG4gICAgfVxuXG4gICAgcmV0dXJuIHRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGFyc2VyQ1FMO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFRoZSBiZWhhdmlvcnMncyBmaWx0ZXIgZGF0YSBjb250cm9sbGVyLlxuICAgICAqIEBkZXNjIFRoaXMgZ2V0dGVyL3NldHRlciBpcyBzeW50YWN0aWMgc3VnYXIgZm9yIGNhbGxzIHRvIGBnZXRDb250cm9sbGVyYCBhbmQgYHNldENvbnRyb2xsZXJgLlxuICAgICAqIEBwYXJhbSB7ZGF0YUNvbnRyb2xJbnRlcmZhY2V8dW5kZWZpbmVkfG51bGx9IGZpbHRlciAtIE9uZSBvZjpcbiAgICAgKiAqIEEgZmlsdGVyIG9iamVjdCwgdHVybmluZyBmaWx0ZXIgKk9OKi5cbiAgICAgKiAqIGB1bmRlZmluZWRgLCB0aGUgbnVsbCBmaWx0ZXIgaXMgcmVhc3NpZ25lZCB0byB0aGUgZ3JpZCwgdHVybmluZyBmaWx0ZXJpbmcgKk9GRi4qXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yI1xuICAgICAqL1xuICAgIGdldCBmaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRyb2xsZXIoJ2ZpbHRlcicpO1xuICAgIH0sXG4gICAgc2V0IGZpbHRlcihmaWx0ZXIpIHtcbiAgICAgICAgdGhpcy5zZXRDb250cm9sbGVyKCdmaWx0ZXInLCBmaWx0ZXIpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IGNvbHVtbkluZGV4T3JOYW1lIC0gVGhlIF9jb2x1bW4gZmlsdGVyXyB0byBzZXQuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBnZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgZ2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhTW9kZWwuZ2V0RmlsdGVyKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGEgcGFydGljdWxhciBjb2x1bW4gZmlsdGVyJ3Mgc3RhdGUuXG4gICAgICogQGRlc2MgQWZ0ZXIgc2V0dGluZyB0aGUgbmV3IGZpbHRlciBzdGF0ZSwgcmVhcHBsaWVzIHRoZSBmaWx0ZXIgdG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGBmaWx0ZXIuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBzZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBCZWhhdmlvciNcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmRhdGFNb2RlbC5zZXRGaWx0ZXIoY29sdW1uSW5kZXhPck5hbWUsIHN0YXRlLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgZ2V0RmlsdGVyczogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhTW9kZWwuZ2V0RmlsdGVycyhvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgc2V0RmlsdGVyczogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5kYXRhTW9kZWwuc2V0RmlsdGVycyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yI1xuICAgICAqL1xuICAgIGdldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFNb2RlbC5nZXRUYWJsZUZpbHRlcihvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgQmVoYXZpb3IjXG4gICAgICovXG4gICAgc2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZGF0YU1vZGVsLnNldFRhYmxlRmlsdGVyKHN0YXRlLCBvcHRpb25zKTtcbiAgICB9LFxuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFRoZSBiZWhhdmlvcnMncyBmaWx0ZXIgZGF0YSBjb250cm9sbGVyLlxuICAgICAqIEBkZXNjIFRoaXMgZ2V0dGVyL3NldHRlciBpcyBzeW50YWN0aWMgc3VnYXIgZm9yIGNhbGxzIHRvIGBnZXRDb250cm9sbGVyYCBhbmQgYHNldENvbnRyb2xsZXJgLlxuICAgICAqIEBwYXJhbSB7ZGF0YUNvbnRyb2xJbnRlcmZhY2V8dW5kZWZpbmVkfG51bGx9IGZpbHRlciAtIE9uZSBvZjpcbiAgICAgKiAqIEEgZmlsdGVyIG9iamVjdCwgdHVybmluZyBmaWx0ZXIgKk9OKi5cbiAgICAgKiAqIGB1bmRlZmluZWRgLCB0aGUgbnVsbCBmaWx0ZXIgaXMgcmVhc3NpZ25lZCB0byB0aGUgZ3JpZCwgdHVybmluZyBmaWx0ZXJpbmcgKk9GRi4qXG4gICAgICogQG1lbWJlck9mIEJlaGF2aW9yI1xuICAgICAqL1xuICAgIGdldCBmaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldENvbnRyb2xsZXIoJ2ZpbHRlcicpO1xuICAgIH0sXG4gICAgc2V0IGZpbHRlcihmaWx0ZXIpIHtcbiAgICAgICAgdGhpcy5zZXRDb250cm9sbGVyKCdmaWx0ZXInLCBmaWx0ZXIpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSBwYXJ0aWN1bGFyIGNvbHVtbiBmaWx0ZXIncyBzdGF0ZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3ludGF4PSdDUUwnXSAtIFRoZSBzeW50YXggdG8gdXNlIHRvIGRlc2NyaWJlIHRoZSBmaWx0ZXIgc3RhdGUuIE5vdGUgdGhhdCBgZ2V0RmlsdGVyYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIGRhdGFNb2RlbHMuSlNPTi5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBpc0luZGV4ID0gIWlzTmFOKE51bWJlcihjb2x1bW5JbmRleE9yTmFtZSkpLFxuICAgICAgICAgICAgY29sdW1uTmFtZSA9IGlzSW5kZXggPyB0aGlzLnNjaGVtYVtjb2x1bW5JbmRleE9yTmFtZV0ubmFtZSA6IGNvbHVtbkluZGV4T3JOYW1lO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmZpbHRlci5nZXRDb2x1bW5GaWx0ZXJTdGF0ZShjb2x1bW5OYW1lLCBvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgU2V0IGEgcGFydGljdWxhciBjb2x1bW4gZmlsdGVyJ3Mgc3RhdGUuXG4gICAgICogQGRlc2MgQWZ0ZXIgc2V0dGluZyB0aGUgbmV3IGZpbHRlciBzdGF0ZSwgcmVhcHBsaWVzIHRoZSBmaWx0ZXIgdG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gY29sdW1uSW5kZXhPck5hbWUgLSBUaGUgX2NvbHVtbiBmaWx0ZXJfIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xvYmplY3R9IFtzdGF0ZV0gLSBBIGZpbHRlciB0cmVlIG9iamVjdCBvciBhIEpTT04sIFNRTCwgb3IgQ1FMIHN1YmV4cHJlc3Npb24gc3RyaW5nIHRoYXQgZGVzY3JpYmVzIHRoZSBhIG5ldyBzdGF0ZSBmb3IgdGhlIG5hbWVkIGNvbHVtbiBmaWx0ZXIuIFRoZSBleGlzdGluZyBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gaXMgcmVwbGFjZWQgd2l0aCBhIG5ldyBub2RlIGJhc2VkIG9uIHRoaXMgc3RhdGUuIElmIGl0IGRvZXMgbm90IGV4aXN0LCB0aGUgbmV3IHN1YmV4cHJlc3Npb24gaXMgYWRkZWQgdG8gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUgKGBmaWx0ZXIuY29sdW1uRmlsdGVyc2ApLlxuICAgICAqXG4gICAgICogSWYgdW5kZWZpbmVkLCByZW1vdmVzIHRoZSBlbnRpcmUgY29sdW1uIGZpbHRlciBzdWJleHByZXNzaW9uIGZyb20gdGhlIGNvbHVtbiBmaWx0ZXJzIHN1YnRyZWUuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zeW50YXg9J0NRTCddIC0gVGhlIHN5bnRheCB0byB1c2UgdG8gZGVzY3JpYmUgdGhlIGZpbHRlciBzdGF0ZS4gTm90ZSB0aGF0IGBzZXRGaWx0ZXJgJ3MgZGVmYXVsdCBzeW50YXgsIGAnQ1FMJ2AsIGRpZmZlcnMgZnJvbSB0aGUgb3RoZXIgZ2V0IHN0YXRlIG1ldGhvZHMuXG4gICAgICogQHJldHVybnMge3VuZGVmaW5lZHxFcnJvcnxzdHJpbmd9IGB1bmRlZmluZWRgIGluZGljYXRlcyBzdWNjZXNzLlxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgc2V0RmlsdGVyOiBmdW5jdGlvbihjb2x1bW5JbmRleE9yTmFtZSwgc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGlzSW5kZXggPSAhaXNOYU4oTnVtYmVyKGNvbHVtbkluZGV4T3JOYW1lKSksXG4gICAgICAgICAgICBjb2x1bW5OYW1lID0gaXNJbmRleCA/IHRoaXMuc2NoZW1hW2NvbHVtbkluZGV4T3JOYW1lXS5uYW1lIDogY29sdW1uSW5kZXhPck5hbWU7XG5cbiAgICAgICAgdGhpcy5maWx0ZXIuc2V0Q29sdW1uRmlsdGVyU3RhdGUoY29sdW1uTmFtZSwgc3RhdGUsIG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmdyaWQuZmlyZVN5bnRoZXRpY0ZpbHRlckFwcGxpZWRFdmVudCgpO1xuICAgICAgICB0aGlzLnJlaW5kZXgoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIHtAbGluayBEZWZhdWx0RmlsdGVyI2dldFN0YXRlfGdldFN0YXRlfSBtZXRob2QuXG4gICAgICogQHJldHVybnMge0ZpbHRlclRyZWVTdGF0ZU9iamVjdH1cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGdldEZpbHRlcnM6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyLmdldENvbHVtbkZpbHRlcnNTdGF0ZShvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldEZpbHRlcnM6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZmlsdGVyLnNldENvbHVtbkZpbHRlcnNTdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuZ3JpZC5maXJlU3ludGhldGljRmlsdGVyQXBwbGllZEV2ZW50KCk7XG4gICAgICAgIHRoaXMucmVpbmRleCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3Mge0BsaW5rIERlZmF1bHRGaWx0ZXIjZ2V0U3RhdGV8Z2V0U3RhdGV9IG1ldGhvZC5cbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fVxuICAgICAqIEBtZW1iZXJPZiBkYXRhTW9kZWxzLkpTT04ucHJvdG90eXBlXG4gICAgICovXG4gICAgZ2V0VGFibGVGaWx0ZXI6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyLmdldFRhYmxlRmlsdGVyU3RhdGUob3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCBhIHRoZSB0YWJsZSBmaWx0ZXIgc3RhdGUuXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgZGF0YU1vZGVscy5KU09OLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmZpbHRlci5zZXRUYWJsZUZpbHRlclN0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5ncmlkLmZpcmVTeW50aGV0aWNGaWx0ZXJBcHBsaWVkRXZlbnQoKTtcbiAgICAgICAgdGhpcy5yZWluZGV4KCk7XG4gICAgfSxcblxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBUaGUgZ3JpZCBpbnN0YW5jZSdzIGZpbHRlciBkYXRhIGNvbnRyb2xsZXIuXG4gICAgICogQGRlc2MgVGhpcyBnZXR0ZXIvc2V0dGVyIGlzIHN5bnRhY3RpYyBzdWdhciBmb3IgY2FsbHMgdG8gYGdldENvbnRyb2xsZXJgIGFuZCBgc2V0Q29udHJvbGxlcmAuXG4gICAgICpcbiAgICAgKiBJbiBhZGRpdGlvbiB0byBhIGRhdGEgbW9kZWwgdGhhdCBhY2NlcHRzIGFuIGRhdGEgY29udHJvbGxlciBvZiB0eXBlICdmaWx0ZXInLCB0byBkaXNwbGF5IHRoZSBzdGFuZGFyZCBmaWx0ZXIgY2VsbHMsIHRoZSBmaWx0ZXIgZGF0YSBjb250cm9sbGVyIGFsc28gcmVxdWlyZXMgRmlsdGVyU3ViZ3JpZCBpbiB0aGUgc3ViZ3JpZHMgbGlzdC5cbiAgICAgKiBAcGFyYW0ge2RhdGFDb250cm9sSW50ZXJmYWNlfHVuZGVmaW5lZHxudWxsfSBmaWx0ZXIgLSBPbmUgb2Y6XG4gICAgICogKiBBIGZpbHRlciBvYmplY3QsIHR1cm5pbmcgZmlsdGVyICpPTiouXG4gICAgICogKiBgdW5kZWZpbmVkYCwgdGhlIG51bGwgZmlsdGVyIGlzIHJlYXNzaWduZWQgdG8gdGhlIGdyaWQsIHR1cm5pbmcgZmlsdGVyaW5nICpPRkYuKlxuICAgICAqIEBtZW1iZXJPZiBIeXBlcmdyaWQjXG4gICAgICovXG4gICAgZ2V0IGZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q29udHJvbGxlcignZmlsdGVyJyk7XG4gICAgfSxcbiAgICBzZXQgZmlsdGVyKGZpbHRlcikge1xuICAgICAgICB0aGlzLnNldENvbnRyb2xsZXIoJ2ZpbHRlcicsIGZpbHRlcik7XG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3ludGF4PSdDUUwnXSAtIFRoZSBzeW50YXggdG8gdXNlIHRvIGRlc2NyaWJlIHRoZSBmaWx0ZXIgc3RhdGUuIE5vdGUgdGhhdCBgZ2V0RmlsdGVyYCdzIGRlZmF1bHQgc3ludGF4LCBgJ0NRTCdgLCBkaWZmZXJzIGZyb20gdGhlIG90aGVyIGdldCBzdGF0ZSBtZXRob2RzLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yLmdldEZpbHRlcihjb2x1bW5JbmRleE9yTmFtZSwgb3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IFNldCBhIHBhcnRpY3VsYXIgY29sdW1uIGZpbHRlcidzIHN0YXRlLlxuICAgICAqIEBkZXNjIEFmdGVyIHNldHRpbmcgdGhlIG5ldyBmaWx0ZXIgc3RhdGU6XG4gICAgICogKiBSZWFwcGxpZXMgdGhlIGZpbHRlciB0byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICogKiBDYWxscyBgYmVoYXZpb3JDaGFuZ2VkKClgIHRvIHVwZGF0ZSB0aGUgZ3JpZCBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSBjb2x1bW5JbmRleE9yTmFtZSAtIFRoZSBfY29sdW1uIGZpbHRlcl8gdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfG9iamVjdH0gW3N0YXRlXSAtIEEgZmlsdGVyIHRyZWUgb2JqZWN0IG9yIGEgSlNPTiwgU1FMLCBvciBDUUwgc3ViZXhwcmVzc2lvbiBzdHJpbmcgdGhhdCBkZXNjcmliZXMgdGhlIGEgbmV3IHN0YXRlIGZvciB0aGUgbmFtZWQgY29sdW1uIGZpbHRlci4gVGhlIGV4aXN0aW5nIGNvbHVtbiBmaWx0ZXIgc3ViZXhwcmVzc2lvbiBpcyByZXBsYWNlZCB3aXRoIGEgbmV3IG5vZGUgYmFzZWQgb24gdGhpcyBzdGF0ZS4gSWYgaXQgZG9lcyBub3QgZXhpc3QsIHRoZSBuZXcgc3ViZXhwcmVzc2lvbiBpcyBhZGRlZCB0byB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZSAoYGZpbHRlci5jb2x1bW5GaWx0ZXJzYCkuXG4gICAgICpcbiAgICAgKiBJZiB1bmRlZmluZWQsIHJlbW92ZXMgdGhlIGVudGlyZSBjb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb24gZnJvbSB0aGUgY29sdW1uIGZpbHRlcnMgc3VidHJlZS5cbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVTZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXSAtIFBhc3NlZCB0byB0aGUgZmlsdGVyJ3MgW3NldFN0YXRlXXtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9GaWx0ZXJUcmVlLmh0bWwjc2V0U3RhdGV9IG1ldGhvZC4gWW91IG1heSBtaXggaW4gbWVtYmVycyBvZiB0aGUge0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL2dsb2JhbC5odG1sI0ZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdHxGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnN5bnRheD0nQ1FMJ10gLSBUaGUgc3ludGF4IHRvIHVzZSB0byBkZXNjcmliZSB0aGUgZmlsdGVyIHN0YXRlLiBOb3RlIHRoYXQgYHNldEZpbHRlcmAncyBkZWZhdWx0IHN5bnRheCwgYCdDUUwnYCwgZGlmZmVycyBmcm9tIHRoZSBvdGhlciBnZXQgc3RhdGUgbWV0aG9kcy5cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXI6IGZ1bmN0aW9uKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICBpZiAodGhpcy5jZWxsRWRpdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxFZGl0b3IuaGlkZUVkaXRvcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYmVoYXZpb3Iuc2V0RmlsdGVyKGNvbHVtbkluZGV4T3JOYW1lLCBzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3JDaGFuZ2VkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJzOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlaGF2aW9yLmdldEZpbHRlcnMob3B0aW9ucyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBzdGF0ZVxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVNldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyBbc2V0U3RhdGVde0BsaW5rIGh0dHA6Ly9qb25laXQuZ2l0aHViLmlvL2ZpbHRlci10cmVlL0ZpbHRlclRyZWUuaHRtbCNzZXRTdGF0ZX0gbWV0aG9kLiBZb3UgbWF5IG1peCBpbiBtZW1iZXJzIG9mIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvZ2xvYmFsLmh0bWwjRmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdH1cbiAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfEVycm9yfHN0cmluZ30gYHVuZGVmaW5lZGAgaW5kaWNhdGVzIHN1Y2Nlc3MuXG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXRGaWx0ZXJzOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICBpZiAodGhpcy5jZWxsRWRpdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxFZGl0b3IuaGlkZUVkaXRvcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYmVoYXZpb3Iuc2V0RmlsdGVycyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmVoYXZpb3JDaGFuZ2VkKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZUdldFN0YXRlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gUGFzc2VkIHRvIHRoZSBmaWx0ZXIncyB7QGxpbmsgRGVmYXVsdEZpbHRlciNnZXRTdGF0ZXxnZXRTdGF0ZX0gbWV0aG9kLlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9XG4gICAgICogQG1lbWJlck9mIEh5cGVyZ3JpZC5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBnZXRUYWJsZUZpbHRlcjogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5iZWhhdmlvci5nZXRUYWJsZUZpbHRlcihvcHRpb25zKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc10gLSBQYXNzZWQgdG8gdGhlIGZpbHRlcidzIFtzZXRTdGF0ZV17QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvRmlsdGVyVHJlZS5odG1sI3NldFN0YXRlfSBtZXRob2QuIFlvdSBtYXkgbWl4IGluIG1lbWJlcnMgb2YgdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9nbG9iYWwuaHRtbCNGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R8RmlsdGVyVHJlZVZhbGlkYXRpb25PcHRpb25zT2JqZWN0fVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RXJyb3J8c3RyaW5nfSBgdW5kZWZpbmVkYCBpbmRpY2F0ZXMgc3VjY2Vzcy5cbiAgICAgKiBAbWVtYmVyT2YgSHlwZXJncmlkLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHNldFRhYmxlRmlsdGVyOiBmdW5jdGlvbihzdGF0ZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmJlaGF2aW9yLnNldFRhYmxlRmlsdGVyKHN0YXRlLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5iZWhhdmlvckNoYW5nZWQoKTtcbiAgICB9LFxuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuLyoqIEBuYW1lc3BhY2UgY3NzSW5qZWN0b3IgKi9cblxuLyoqXG4gKiBAc3VtbWFyeSBJbnNlcnQgYmFzZSBzdHlsZXNoZWV0IGludG8gRE9NXG4gKlxuICogQGRlc2MgQ3JlYXRlcyBhIG5ldyBgPHN0eWxlPi4uLjwvc3R5bGU+YCBlbGVtZW50IGZyb20gdGhlIG5hbWVkIHRleHQgc3RyaW5nKHMpIGFuZCBpbnNlcnRzIGl0IGJ1dCBvbmx5IGlmIGl0IGRvZXMgbm90IGFscmVhZHkgZXhpc3QgaW4gdGhlIHNwZWNpZmllZCBjb250YWluZXIgYXMgcGVyIGByZWZlcmVuY2VFbGVtZW50YC5cbiAqXG4gKiA+IENhdmVhdDogSWYgc3R5bGVzaGVldCBpcyBmb3IgdXNlIGluIGEgc2hhZG93IERPTSwgeW91IG11c3Qgc3BlY2lmeSBhIGxvY2FsIGByZWZlcmVuY2VFbGVtZW50YC5cbiAqXG4gKiBAcmV0dXJucyBBIHJlZmVyZW5jZSB0byB0aGUgbmV3bHkgY3JlYXRlZCBgPHN0eWxlPi4uLjwvc3R5bGU+YCBlbGVtZW50LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBjc3NSdWxlc1xuICogQHBhcmFtIHtzdHJpbmd9IFtJRF1cbiAqIEBwYXJhbSB7dW5kZWZpbmVkfG51bGx8RWxlbWVudHxzdHJpbmd9IFtyZWZlcmVuY2VFbGVtZW50XSAtIENvbnRhaW5lciBmb3IgaW5zZXJ0aW9uLiBPdmVybG9hZHM6XG4gKiAqIGB1bmRlZmluZWRgIHR5cGUgKG9yIG9taXR0ZWQpOiBpbmplY3RzIHN0eWxlc2hlZXQgYXQgdG9wIG9mIGA8aGVhZD4uLi48L2hlYWQ+YCBlbGVtZW50XG4gKiAqIGBudWxsYCB2YWx1ZTogaW5qZWN0cyBzdHlsZXNoZWV0IGF0IGJvdHRvbSBvZiBgPGhlYWQ+Li4uPC9oZWFkPmAgZWxlbWVudFxuICogKiBgRWxlbWVudGAgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBlbGVtZW50LCB3aGVyZXZlciBpdCBpcyBmb3VuZC5cbiAqICogYHN0cmluZ2AgdHlwZTogaW5qZWN0cyBzdHlsZXNoZWV0IGltbWVkaWF0ZWx5IGJlZm9yZSBnaXZlbiBmaXJzdCBlbGVtZW50IGZvdW5kIHRoYXQgbWF0Y2hlcyB0aGUgZ2l2ZW4gY3NzIHNlbGVjdG9yLlxuICpcbiAqIEBtZW1iZXJPZiBjc3NJbmplY3RvclxuICovXG5mdW5jdGlvbiBjc3NJbmplY3Rvcihjc3NSdWxlcywgSUQsIHJlZmVyZW5jZUVsZW1lbnQpIHtcbiAgICBpZiAodHlwZW9mIHJlZmVyZW5jZUVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlZmVyZW5jZUVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHJlZmVyZW5jZUVsZW1lbnQpO1xuICAgICAgICBpZiAoIXJlZmVyZW5jZUVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRocm93ICdDYW5ub3QgZmluZCByZWZlcmVuY2UgZWxlbWVudCBmb3IgQ1NTIGluamVjdGlvbi4nO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChyZWZlcmVuY2VFbGVtZW50ICYmICEocmVmZXJlbmNlRWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICAgIHRocm93ICdHaXZlbiB2YWx1ZSBub3QgYSByZWZlcmVuY2UgZWxlbWVudC4nO1xuICAgIH1cblxuICAgIHZhciBjb250YWluZXIgPSByZWZlcmVuY2VFbGVtZW50ICYmIHJlZmVyZW5jZUVsZW1lbnQucGFyZW50Tm9kZSB8fCBkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07XG5cbiAgICBpZiAoSUQpIHtcbiAgICAgICAgSUQgPSBjc3NJbmplY3Rvci5pZFByZWZpeCArIElEO1xuXG4gICAgICAgIGlmIChjb250YWluZXIucXVlcnlTZWxlY3RvcignIycgKyBJRCkpIHtcbiAgICAgICAgICAgIHJldHVybjsgLy8gc3R5bGVzaGVldCBhbHJlYWR5IGluIERPTVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgICBzdHlsZS50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAoSUQpIHtcbiAgICAgICAgc3R5bGUuaWQgPSBJRDtcbiAgICB9XG4gICAgaWYgKGNzc1J1bGVzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgY3NzUnVsZXMgPSBjc3NSdWxlcy5qb2luKCdcXG4nKTtcbiAgICB9XG4gICAgY3NzUnVsZXMgPSAnXFxuJyArIGNzc1J1bGVzICsgJ1xcbic7XG4gICAgaWYgKHN0eWxlLnN0eWxlU2hlZXQpIHtcbiAgICAgICAgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzUnVsZXM7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzUnVsZXMpKTtcbiAgICB9XG5cbiAgICBpZiAocmVmZXJlbmNlRWxlbWVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlZmVyZW5jZUVsZW1lbnQgPSBjb250YWluZXIuZmlyc3RDaGlsZDtcbiAgICB9XG5cbiAgICBjb250YWluZXIuaW5zZXJ0QmVmb3JlKHN0eWxlLCByZWZlcmVuY2VFbGVtZW50KTtcblxuICAgIHJldHVybiBzdHlsZTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBPcHRpb25hbCBwcmVmaXggZm9yIGA8c3R5bGU+YCB0YWcgSURzLlxuICogQGRlc2MgRGVmYXVsdHMgdG8gYCdpbmplY3RlZC1zdHlsZXNoZWV0LSdgLlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBtZW1iZXJPZiBjc3NJbmplY3RvclxuICovXG5jc3NJbmplY3Rvci5pZFByZWZpeCA9ICdpbmplY3RlZC1zdHlsZXNoZWV0LSc7XG5cbi8vIEludGVyZmFjZVxubW9kdWxlLmV4cG9ydHMgPSBjc3NJbmplY3RvcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG92ZXJyaWRlciA9IHJlcXVpcmUoJ292ZXJyaWRlcicpO1xuXG4vKiogQG5hbWVzcGFjZSBleHRlbmQtbWUgKiovXG5cbi8qKiBAc3VtbWFyeSBFeHRlbmRzIGFuIGV4aXN0aW5nIGNvbnN0cnVjdG9yIGludG8gYSBuZXcgY29uc3RydWN0b3IuXG4gKlxuICogQHJldHVybnMge0NoaWxkQ29uc3RydWN0b3J9IEEgbmV3IGNvbnN0cnVjdG9yLCBleHRlbmRlZCBmcm9tIHRoZSBnaXZlbiBjb250ZXh0LCBwb3NzaWJseSB3aXRoIHNvbWUgcHJvdG90eXBlIGFkZGl0aW9ucy5cbiAqXG4gKiBAZGVzYyBFeHRlbmRzIFwib2JqZWN0c1wiIChjb25zdHJ1Y3RvcnMpLCB3aXRoIG9wdGlvbmFsIGFkZGl0aW9uYWwgY29kZSwgb3B0aW9uYWwgcHJvdG90eXBlIGFkZGl0aW9ucywgYW5kIG9wdGlvbmFsIHByb3RvdHlwZSBtZW1iZXIgYWxpYXNlcy5cbiAqXG4gKiA+IENBVkVBVDogTm90IHRvIGJlIGNvbmZ1c2VkIHdpdGggVW5kZXJzY29yZS1zdHlsZSAuZXh0ZW5kKCkgd2hpY2ggaXMgc29tZXRoaW5nIGVsc2UgZW50aXJlbHkuIEkndmUgdXNlZCB0aGUgbmFtZSBcImV4dGVuZFwiIGhlcmUgYmVjYXVzZSBvdGhlciBwYWNrYWdlcyAobGlrZSBCYWNrYm9uZS5qcykgdXNlIGl0IHRoaXMgd2F5LiBZb3UgYXJlIGZyZWUgdG8gY2FsbCBpdCB3aGF0ZXZlciB5b3Ugd2FudCB3aGVuIHlvdSBcInJlcXVpcmVcIiBpdCwgc3VjaCBhcyBgdmFyIGluaGVyaXRzID0gcmVxdWlyZSgnZXh0ZW5kJylgLlxuICpcbiAqIFByb3ZpZGUgYSBjb25zdHJ1Y3RvciBhcyB0aGUgY29udGV4dCBhbmQgYW55IHByb3RvdHlwZSBhZGRpdGlvbnMgeW91IHJlcXVpcmUgaW4gdGhlIGZpcnN0IGFyZ3VtZW50LlxuICpcbiAqIEZvciBleGFtcGxlLCBpZiB5b3Ugd2lzaCB0byBiZSBhYmxlIHRvIGV4dGVuZCBgQmFzZUNvbnN0cnVjdG9yYCB0byBhIG5ldyBjb25zdHJ1Y3RvciB3aXRoIHByb3RvdHlwZSBvdmVycmlkZXMgYW5kL29yIGFkZGl0aW9ucywgYmFzaWMgdXNhZ2UgaXM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIEJhc2UgPSByZXF1aXJlKCdleHRlbmQtbWUnKS5CYXNlO1xuICogdmFyIEJhc2VDb25zdHJ1Y3RvciA9IEJhc2UuZXh0ZW5kKGJhc2VQcm90b3R5cGUpOyAvLyBtaXhlcyBpbiAuZXh0ZW5kXG4gKiB2YXIgQ2hpbGRDb25zdHJ1Y3RvciA9IEJhc2VDb25zdHJ1Y3Rvci5leHRlbmQoY2hpbGRQcm90b3R5cGVPdmVycmlkZXNBbmRBZGRpdGlvbnMpO1xuICogdmFyIEdyYW5kY2hpbGRDb25zdHJ1Y3RvciA9IENoaWxkQ29uc3RydWN0b3IuZXh0ZW5kKGdyYW5kY2hpbGRQcm90b3R5cGVPdmVycmlkZXNBbmRBZGRpdGlvbnMpO1xuICogYGBgXG4gKlxuICogVGhpcyBmdW5jdGlvbiAoYGV4dGVuZCgpYCkgaXMgYWRkZWQgdG8gdGhlIG5ldyBleHRlbmRlZCBvYmplY3QgY29uc3RydWN0b3IgYXMgYSBwcm9wZXJ0eSBgLmV4dGVuZGAsIGVzc2VudGlhbGx5IG1ha2luZyB0aGUgb2JqZWN0IGNvbnN0cnVjdG9yIGl0c2VsZiBlYXNpbHkgXCJleHRlbmRhYmxlLlwiIChOb3RlOiBUaGlzIGlzIGEgcHJvcGVydHkgb2YgZWFjaCBjb25zdHJ1Y3RvciBhbmQgbm90IGEgbWV0aG9kIG9mIGl0cyBwcm90b3R5cGUhKVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBbZXh0ZW5kZWRDbGFzc05hbWVdIC0gVGhpcyBpcyBzaW1wbHkgYWRkZWQgdG8gdGhlIHByb3RvdHlwZSBhcyAkJENMQVNTX05BTUUuIFVzZWZ1bCBmb3IgZGVidWdnaW5nIGJlY2F1c2UgYWxsIGRlcml2ZWQgY29uc3RydWN0b3JzIGFwcGVhciB0byBoYXZlIHRoZSBzYW1lIG5hbWUgKFwiQ29uc3RydWN0b3JcIikgaW4gdGhlIGRlYnVnZ2VyLlxuICpcbiAqIEBwYXJhbSB7ZXh0ZW5kZWRQcm90b3R5cGVBZGRpdGlvbnNPYmplY3R9IFtwcm90b3R5cGVBZGRpdGlvbnNdIC0gT2JqZWN0IHdpdGggbWVtYmVycyB0byBjb3B5IHRvIG5ldyBjb25zdHJ1Y3RvcidzIHByb3RvdHlwZS5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtkZWJ1Z10gLSBTZWUgcGFyYW1ldGVyIGBleHRlbmRlZENsYXNzTmFtZWAgXyhhYm92ZSlfLlxuICpcbiAqIEBwcm9wZXJ0eSB7b2JqZWN0fSBCYXNlIC0gQSBjb252ZW5pZW50IGJhc2UgY2xhc3MgZnJvbSB3aGljaCBhbGwgb3RoZXIgY2xhc3NlcyBjYW4gYmUgZXh0ZW5kZWQuXG4gKlxuICogQG1lbWJlck9mIGV4dGVuZC1tZVxuICovXG5mdW5jdGlvbiBleHRlbmQoZXh0ZW5kZWRDbGFzc05hbWUsIHByb3RvdHlwZUFkZGl0aW9ucykge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMgPSB7fTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBleHRlbmRlZENsYXNzTmFtZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgIHByb3RvdHlwZUFkZGl0aW9ucyA9IGV4dGVuZGVkQ2xhc3NOYW1lO1xuICAgICAgICAgICAgICAgICAgICBleHRlbmRlZENsYXNzTmFtZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgICAgICAgICAgcHJvdG90eXBlQWRkaXRpb25zID0ge307XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRocm93ICdTaW5nbGUtcGFyYW1ldGVyIG92ZXJsb2FkIG11c3QgYmUgZWl0aGVyIHN0cmluZyBvciBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4dGVuZGVkQ2xhc3NOYW1lICE9PSAnc3RyaW5nJyB8fCB0eXBlb2YgcHJvdG90eXBlQWRkaXRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHRocm93ICdUd28tcGFyYW1ldGVyIG92ZXJsb2FkIG11c3QgYmUgc3RyaW5nLCBvYmplY3QuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgJ1RvbyBtYW55IHBhcmFtZXRlcnMnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIENvbnN0cnVjdG9yKCkge1xuICAgICAgICBpZiAocHJvdG90eXBlQWRkaXRpb25zLnByZUluaXRpYWxpemUpIHtcbiAgICAgICAgICAgIHByb3RvdHlwZUFkZGl0aW9ucy5wcmVJbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpbml0aWFsaXplUHJvdG90eXBlQ2hhaW4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICBpZiAocHJvdG90eXBlQWRkaXRpb25zLnBvc3RJbml0aWFsaXplKSB7XG4gICAgICAgICAgICBwcm90b3R5cGVBZGRpdGlvbnMucG9zdEluaXRpYWxpemUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIENvbnN0cnVjdG9yLmV4dGVuZCA9IGV4dGVuZDtcblxuICAgIHZhciBwcm90b3R5cGUgPSBDb25zdHJ1Y3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHRoaXMucHJvdG90eXBlKTtcbiAgICBwcm90b3R5cGUuY29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcblxuICAgIGlmIChleHRlbmRlZENsYXNzTmFtZSkge1xuICAgICAgICBwcm90b3R5cGUuJCRDTEFTU19OQU1FID0gZXh0ZW5kZWRDbGFzc05hbWU7XG4gICAgfVxuXG4gICAgb3ZlcnJpZGVyKHByb3RvdHlwZSwgcHJvdG90eXBlQWRkaXRpb25zKTtcblxuICAgIHJldHVybiBDb25zdHJ1Y3Rvcjtcbn1cblxuZnVuY3Rpb24gQmFzZSgpIHt9XG5CYXNlLnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogQmFzZS5wcm90b3R5cGUuY29uc3RydWN0b3IsXG4gICAgZ2V0IHN1cGVyKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKSk7XG4gICAgfVxufTtcbkJhc2UuZXh0ZW5kID0gZXh0ZW5kO1xuZXh0ZW5kLkJhc2UgPSBCYXNlO1xuXG4vKiogQHR5cGVkZWYge2Z1bmN0aW9ufSBleHRlbmRlZENvbnN0cnVjdG9yXG4gKiBAcHJvcGVydHkgcHJvdG90eXBlLnN1cGVyIC0gQSByZWZlcmVuY2UgdG8gdGhlIHByb3RvdHlwZSB0aGlzIGNvbnN0cnVjdG9yIHdhcyBleHRlbmRlZCBmcm9tLlxuICogQHByb3BlcnR5IFtleHRlbmRdIC0gSWYgYHByb3RvdHlwZUFkZGl0aW9ucy5leHRlbmRhYmxlYCB3YXMgdHJ1dGh5LCB0aGlzIHdpbGwgYmUgYSByZWZlcmVuY2UgdG8ge0BsaW5rIGV4dGVuZC5leHRlbmR8ZXh0ZW5kfS5cbiAqL1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gZXh0ZW5kZWRQcm90b3R5cGVBZGRpdGlvbnNPYmplY3RcbiAqIEBkZXNjIEFsbCBtZW1iZXJzIGFyZSBjb3BpZWQgdG8gdGhlIG5ldyBvYmplY3QuIFRoZSBmb2xsb3dpbmcgaGF2ZSBzcGVjaWFsIG1lYW5pbmcuXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSBbaW5pdGlhbGl6ZV0gLSBBZGRpdGlvbmFsIGNvbnN0cnVjdG9yIGNvZGUgZm9yIG5ldyBvYmplY3QuIFRoaXMgbWV0aG9kIGlzIGFkZGVkIHRvIHRoZSBuZXcgY29uc3RydWN0b3IncyBwcm90b3R5cGUuIEdldHMgcGFzc2VkIG5ldyBvYmplY3QgYXMgY29udGV4dCArIHNhbWUgYXJncyBhcyBjb25zdHJ1Y3RvciBpdHNlbGYuIENhbGxlZCBvbiBpbnN0YW50aWF0aW9uIGFmdGVyIHNpbWlsYXIgZnVuY3Rpb24gaW4gYWxsIGFuY2VzdG9ycyBjYWxsZWQgd2l0aCBzYW1lIHNpZ25hdHVyZS5cbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IFtwcmVJbml0aWFsaXplXSAtIENhbGxlZCBiZWZvcmUgdGhlIGBpbml0aWFsaXplYCBjYXNjYWRlLiBHZXRzIHBhc3NlZCBuZXcgb2JqZWN0IGFzIGNvbnRleHQgKyBzYW1lIGFyZ3MgYXMgY29uc3RydWN0b3IgaXRzZWxmLlxuICogQHByb3BlcnR5IHtmdW5jdGlvbn0gW3Bvc3RJbml0aWFsaXplXSAtIENhbGxlZCBhZnRlciB0aGUgYGluaXRpYWxpemVgIGNhc2NhZGUuIEdldHMgcGFzc2VkIG5ldyBvYmplY3QgYXMgY29udGV4dCArIHNhbWUgYXJncyBhcyBjb25zdHJ1Y3RvciBpdHNlbGYuXG4gKi9cblxuLyoqIEBzdW1tYXJ5IENhbGwgYWxsIGBpbml0aWFsaXplYCBtZXRob2RzIGZvdW5kIGluIHByb3RvdHlwZSBjaGFpbiwgYmVnaW5uaW5nIHdpdGggdGhlIG1vc3Qgc2VuaW9yIGFuY2VzdG9yJ3MgZmlyc3QuXG4gKiBAZGVzYyBUaGlzIHJlY3Vyc2l2ZSByb3V0aW5lIGlzIGNhbGxlZCBieSB0aGUgY29uc3RydWN0b3IuXG4gKiAxLiBXYWxrcyBiYWNrIHRoZSBwcm90b3R5cGUgY2hhaW4gdG8gYE9iamVjdGAncyBwcm90b3R5cGVcbiAqIDIuIFdhbGtzIGZvcndhcmQgdG8gbmV3IG9iamVjdCwgY2FsbGluZyBhbnkgYGluaXRpYWxpemVgIG1ldGhvZHMgaXQgZmluZHMgYWxvbmcgdGhlIHdheSB3aXRoIHRoZSBzYW1lIGNvbnRleHQgYW5kIGFyZ3VtZW50cyB3aXRoIHdoaWNoIHRoZSBjb25zdHJ1Y3RvciB3YXMgY2FsbGVkLlxuICogQHByaXZhdGVcbiAqIEBtZW1iZXJPZiBleHRlbmQtbWVcbiAqL1xuZnVuY3Rpb24gaW5pdGlhbGl6ZVByb3RvdHlwZUNoYWluKCkge1xuICAgIHZhciB0ZXJtID0gdGhpcyxcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICByZWN1cih0ZXJtKTtcblxuICAgIGZ1bmN0aW9uIHJlY3VyKG9iaikge1xuICAgICAgICB2YXIgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKTtcbiAgICAgICAgaWYgKHByb3RvLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICAgICAgICAgIHJlY3VyKHByb3RvKTtcbiAgICAgICAgICAgIGlmIChwcm90by5oYXNPd25Qcm9wZXJ0eSgnaW5pdGlhbGl6ZScpKSB7XG4gICAgICAgICAgICAgICAgcHJvdG8uaW5pdGlhbGl6ZS5hcHBseSh0ZXJtLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHNbJ2NvbHVtbi1DUUwtc3ludGF4J10gPSBbXG4nPGxpPicsXG4nXHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNvcHlcIj48L2J1dHRvbj4nLFxuJ1x0PGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2PicsXG4nXHR7MX06JyxcbidcdDxpbnB1dCBuYW1lPVwiezJ9XCIgY2xhc3M9XCJ7NH1cIiB2YWx1ZT1cInszOmVuY29kZX1cIj4nLFxuJzwvbGk+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0c1snY29sdW1uLVNRTC1zeW50YXgnXSA9IFtcbic8bGk+JyxcbidcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29weVwiPjwvYnV0dG9uPicsXG4nXHQ8ZGl2IGNsYXNzPVwiZmlsdGVyLXRyZWUtcmVtb3ZlLWJ1dHRvblwiIHRpdGxlPVwiZGVsZXRlIGNvbmRpdGlvbmFsXCI+PC9kaXY+JyxcbidcdHsxfTonLFxuJ1x0PHRleHRhcmVhIG5hbWU9XCJ7Mn1cIiByb3dzPVwiMVwiIGNsYXNzPVwiezR9XCI+ezM6ZW5jb2RlfTwvdGV4dGFyZWE+Jyxcbic8L2xpPidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMuY29sdW1uRmlsdGVyID0gW1xuJzxzcGFuIGNsYXNzPVwiZmlsdGVyLXRyZWVcIj4nLFxuJ1x0IDxzdHJvbmc+PHNwYW4+ezJ9IDwvc3Bhbj5jb2x1bW4gZmlsdGVyIHN1YmV4cHJlc3Npb246PC9zdHJvbmc+PGJyPicsXG4nXHQgTWF0Y2gnLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1vclwiPmFueTwvbGFiZWw+JyxcbidcdCA8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIGNsYXNzPVwiZmlsdGVyLXRyZWUtb3AtY2hvaWNlXCIgbmFtZT1cInRyZWVPcHsxfVwiIHZhbHVlPVwib3AtYW5kXCI+YWxsPC9sYWJlbD4nLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1ub3JcIj5ub25lPC9sYWJlbD4nLFxuJ1x0IG9mIHRoZSBmb2xsb3dpbmc6JyxcbidcdCA8c2VsZWN0PicsXG4nXHRcdCA8b3B0aW9uIHZhbHVlPVwiXCI+TmV3IGV4cHJlc3Npb24maGVsbGlwOzwvb3B0aW9uPicsXG4nXHQgPC9zZWxlY3Q+JyxcbidcdCA8b2w+PC9vbD4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5jb2x1bW5GaWx0ZXJzID0gW1xuJzxzcGFuIGNsYXNzPVwiZmlsdGVyLXRyZWUgZmlsdGVyLXRyZWUtdHlwZS1jb2x1bW4tZmlsdGVyc1wiPicsXG4nXHQgTWF0Y2ggPHN0cm9uZz5hbGw8L3N0cm9uZz4gb2YgdGhlIGZvbGxvd2luZyBjb2x1bW4gZmlsdGVyczonLFxuJ1x0IDxvbD48L29sPicsXG4nIDwvc3Bhbj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLmxvY2tlZENvbHVtbiA9IFtcbic8c3Bhbj4nLFxuJ1x0IHsxOmVuY29kZX0nLFxuJ1x0IDxpbnB1dCB0eXBlPVwiaGlkZGVuXCIgdmFsdWU9XCJ7Mn1cIj4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5ub3RlID0gW1xuJzxkaXYgY2xhc3M9XCJmb290bm90ZXNcIj4nLFxuJ1x0PGRpdiBjbGFzcz1cImZvb3Rub3RlXCI+PC9kaXY+JyxcbidcdDxwPlNlbGVjdCBhIG5ldyB2YWx1ZSBvciBkZWxldGUgdGhlIGV4cHJlc3Npb24gYWx0b2dldGhlci48L3A+Jyxcbic8L2Rpdj4nXG5dLmpvaW4oJ1xcbicpO1xuXG5leHBvcnRzLm5vdGVzID0gW1xuJzxkaXYgY2xhc3M9XCJmb290bm90ZXNcIj4nLFxuJ1x0PHA+Tm90ZSB0aGUgZm9sbG93aW5nIGVycm9yIGNvbmRpdGlvbnM6PC9wPicsXG4nXHQ8dWwgY2xhc3M9XCJmb290bm90ZVwiPjwvdWw+JyxcbidcdDxwPlNlbGVjdCBuZXcgdmFsdWVzIG9yIGRlbGV0ZSB0aGUgZXhwcmVzc2lvbiBhbHRvZ2V0aGVyLjwvcD4nLFxuJzwvZGl2Pidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMub3B0aW9uTWlzc2luZyA9IFtcbidUaGUgcmVxdWVzdGVkIHZhbHVlIG9mIDxzcGFuIGNsYXNzPVwiZmllbGQtbmFtZVwiPnsxOmVuY29kZX08L3NwYW4+JyxcbicoPHNwYW4gY2xhc3M9XCJmaWVsZC12YWx1ZVwiPnsyOmVuY29kZX08L3NwYW4+KSBpcyBub3QgdmFsaWQuJ1xuXS5qb2luKCdcXG4nKTtcblxuZXhwb3J0cy5yZW1vdmVCdXR0b24gPSBbXG4nPGRpdiBjbGFzcz1cImZpbHRlci10cmVlLXJlbW92ZS1idXR0b25cIiB0aXRsZT1cImRlbGV0ZSBjb25kaXRpb25hbFwiPjwvZGl2Pidcbl0uam9pbignXFxuJyk7XG5cbmV4cG9ydHMuc3VidHJlZSA9IFtcbic8c3BhbiBjbGFzcz1cImZpbHRlci10cmVlXCI+JyxcbidcdCBNYXRjaCcsXG4nXHQgPGxhYmVsPjxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImZpbHRlci10cmVlLW9wLWNob2ljZVwiIG5hbWU9XCJ0cmVlT3B7MX1cIiB2YWx1ZT1cIm9wLW9yXCI+YW55PC9sYWJlbD4nLFxuJ1x0IDxsYWJlbD48aW5wdXQgdHlwZT1cInJhZGlvXCIgY2xhc3M9XCJmaWx0ZXItdHJlZS1vcC1jaG9pY2VcIiBuYW1lPVwidHJlZU9wezF9XCIgdmFsdWU9XCJvcC1hbmRcIj5hbGw8L2xhYmVsPicsXG4nXHQgPGxhYmVsPjxpbnB1dCB0eXBlPVwicmFkaW9cIiBjbGFzcz1cImZpbHRlci10cmVlLW9wLWNob2ljZVwiIG5hbWU9XCJ0cmVlT3B7MX1cIiB2YWx1ZT1cIm9wLW5vclwiPm5vbmU8L2xhYmVsPicsXG4nXHQgb2YgdGhlIGZvbGxvd2luZzonLFxuJ1x0IDxzZWxlY3Q+JyxcbidcdFx0IDxvcHRpb24gdmFsdWU9XCJcIj5OZXcgZXhwcmVzc2lvbiZoZWxsaXA7PC9vcHRpb24+JyxcbidcdFx0IDxvcHRpb24gdmFsdWU9XCJzdWJleHBcIiBzdHlsZT1cImJvcmRlci1ib3R0b206MXB4IHNvbGlkIGJsYWNrXCI+U3ViZXhwcmVzc2lvbjwvb3B0aW9uPicsXG4nXHQgPC9zZWxlY3Q+JyxcbidcdCA8b2w+PC9vbD4nLFxuJyA8L3NwYW4+J1xuXS5qb2luKCdcXG4nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBGaWx0ZXJUcmVlID0gcmVxdWlyZSgnLi9qcy9GaWx0ZXJUcmVlJyk7XG5GaWx0ZXJUcmVlLk5vZGUgPSByZXF1aXJlKCcuL2pzL0ZpbHRlck5vZGUnKTsgLy8gYWthOiBPYmplY3QuZ2V0UHJvdG90eXBlT2YoRmlsdGVyVHJlZS5wcm90b3R5cGUpLmNvbnN0cnVjdG9yXG5GaWx0ZXJUcmVlLkxlYWYgPSByZXF1aXJlKCcuL2pzL0ZpbHRlckxlYWYnKTsgLy8gYWthOiBGaWx0ZXJUcmVlLnByb3RvdHlwZS5lZGl0b3JzLkRlZmF1bHRcblxuLy8gZXhwb3NlIHNvbWUgb2JqZWN0cyBmb3IgcGx1Zy1pbiBhY2Nlc3NcblxuRmlsdGVyVHJlZS5Db25kaXRpb25hbHMgPSByZXF1aXJlKCcuL2pzL0NvbmRpdGlvbmFscycpO1xuXG4vLyBGT0xMT1dJTkcgUFJPUEVSVElFUyBBUkUgKioqIFRFTVBPUkFSWSAqKiosXG4vLyBGT1IgVEhFIERFTU8gVE8gQUNDRVNTIFRIRVNFIE5PREUgTU9EVUxFUy5cblxuRmlsdGVyVHJlZS5fID0gXztcbkZpbHRlclRyZWUucG9wTWVudSA9IHBvcE1lbnU7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJUcmVlO1xuIiwiLyoqIEBtb2R1bGUgY29uZGl0aW9uYWxzICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIEJhc2UgPSByZXF1aXJlKCdleHRlbmQtbWUnKS5CYXNlO1xudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgcmVnRXhwTElLRSA9IHJlcXVpcmUoJ3JlZ2V4cC1saWtlJyk7XG5cbnZhciBJTiA9ICdJTicsXG4gICAgTk9UX0lOID0gJ05PVCAnICsgSU4sXG4gICAgTElLRSA9ICdMSUtFJyxcbiAgICBOT1RfTElLRSA9ICdOT1QgJyArIExJS0UsXG4gICAgTElLRV9XSUxEX0NBUkQgPSAnJScsXG4gICAgTklMID0gJyc7XG5cbnZhciB0b1N0cmluZztcblxudmFyIGRlZmF1bHRJZFF0cyA9IHtcbiAgICBiZWc6ICdcIicsXG4gICAgZW5kOiAnXCInXG59O1xuXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKi9cbnZhciBDb25kaXRpb25hbHMgPSBCYXNlLmV4dGVuZCh7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzcWxJZFF0c09iamVjdH0gW29wdGlvbnMuc3FsSWRRdHM9e2JlZzonXCInLGVuZDonXCInfV1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGlkUXRzID0gb3B0aW9ucyAmJiBvcHRpb25zLnNxbElkUXRzO1xuICAgICAgICBpZiAoaWRRdHMpIHtcbiAgICAgICAgICAgIHRoaXMuc3FsSWRRdHMgPSBpZFF0czsgLy8gb25seSBvdmVycmlkZSBpZiBkZWZpbmVkXG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc3FsSWRRdHM6IGRlZmF1bHRJZFF0cyxcbiAgICAvKipcbiAgICAgKiBAcGFyYW0gaWRcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZVNxbElkZW50aWZpZXI6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNxbElkUXRzLmJlZyArIGlkICsgdGhpcy5zcWxJZFF0cy5lbmQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBzdHJpbmdcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgbWFrZVNxbFN0cmluZzogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiAnXFwnJyArIHNxRXNjKHN0cmluZykgKyAnXFwnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlTElLRTogZnVuY3Rpb24oYmVnLCBlbmQsIG9wLCBvcmlnaW5hbE9wLCBjKSB7XG4gICAgICAgIHZhciBlc2NhcGVkID0gYy5vcGVyYW5kLnJlcGxhY2UoLyhbX1xcW1xcXSVdKS9nLCAnWyQxXScpOyAvLyBlc2NhcGUgYWxsIExJS0UgcmVzZXJ2ZWQgY2hhcnNcbiAgICAgICAgcmV0dXJuIHRoaXMubWFrZVNxbElkZW50aWZpZXIoYy5jb2x1bW4pICtcbiAgICAgICAgICAgICcgJyArIG9wICtcbiAgICAgICAgICAgICcgJyArIHRoaXMubWFrZVNxbFN0cmluZyhiZWcgKyBlc2NhcGVkICsgZW5kKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlSU46IGZ1bmN0aW9uKG9wLCBjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1ha2VTcWxJZGVudGlmaWVyKGMuY29sdW1uKSArXG4gICAgICAgICAgICAnICcgKyBvcCArXG4gICAgICAgICAgICAnICcgKyAnKFxcJycgKyBzcUVzYyhjLm9wZXJhbmQpLnJlcGxhY2UoL1xccyosXFxzKi9nLCAnXFwnLCBcXCcnKSArICdcXCcpJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBtYWtlOiBmdW5jdGlvbihvcCwgYykge1xuICAgICAgICByZXR1cm4gdGhpcy5tYWtlU3FsSWRlbnRpZmllcihjLmNvbHVtbikgK1xuICAgICAgICAgICAgJyAnICsgb3AgK1xuICAgICAgICAgICAgJyAnICsgYy5tYWtlU3FsT3BlcmFuZCgpO1xuICAgIH1cbn0pO1xuXG52YXIgb3BzID0gQ29uZGl0aW9uYWxzLnByb3RvdHlwZS5vcHMgPSB7XG4gICAgdW5kZWZpbmVkOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdHJ1ZTsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oKSB7IHJldHVybiAnJzsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc8Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhIDwgYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlKCc8JywgYyk7IH1cbiAgICB9LFxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJzw9Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhIDw9IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZSgnPD0nLCBjKTsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc9Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhID09PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJz0nLCBjKTsgfVxuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgICc+PSc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA+PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJz49JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnPic6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYSA+IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZSgnPicsIGMpOyB9XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJzw+Jzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhICE9PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoJzw+JywgYyk7IH1cbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBMSUtFOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIHJlZ0V4cExJS0UuY2FjaGVkKGIsIHRydWUpLnRlc3QoYSk7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZShMSUtFLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIExJS0UnOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuICFyZWdFeHBMSUtFLmNhY2hlZChiLCB0cnVlKS50ZXN0KGEpOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2UoTk9UX0xJS0UsIGMpOyB9LFxuICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgIH0sXG5cbiAgICAvKiogQHR5cGUge3JlbGF0aW9uYWxPcGVyYXRvcn1cbiAgICAgKiBAbWVtYmVyT2YgQ29uZGl0aW9uYWxzI1xuICAgICAqL1xuICAgIElOOiB7IC8vIFRPRE86IGN1cnJlbnRseSBmb3JjaW5nIHN0cmluZyB0eXBpbmc7IHJld29yayBjYWxsaW5nIGNvZGUgdG8gcmVzcGVjdCBjb2x1bW4gdHlwZVxuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBpbk9wKGEsIGIpID49IDA7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUlOKElOLCBjKTsgfSxcbiAgICAgICAgb3BlcmFuZExpc3Q6IHRydWUsXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgJ05PVCBJTic6IHsgLy8gVE9ETzogY3VycmVudGx5IGZvcmNpbmcgc3RyaW5nIHR5cGluZzsgcmV3b3JrIGNhbGxpbmcgY29kZSB0byByZXNwZWN0IGNvbHVtbiB0eXBlXG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIGluT3AoYSwgYikgPCAwOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VJTihOT1RfSU4sIGMpOyB9LFxuICAgICAgICBvcGVyYW5kTGlzdDogdHJ1ZSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICBDT05UQUlOUzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBjb250YWluc09wKGEsIGIpID49IDA7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIExJS0VfV0lMRF9DQVJELCBMSUtFLCAnQ09OVEFJTlMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIENPTlRBSU5TJzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBjb250YWluc09wKGEsIGIpIDwgMDsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlTElLRShMSUtFX1dJTERfQ0FSRCwgTElLRV9XSUxEX0NBUkQsIE5PVF9MSUtFLCAnTk9UIENPTlRBSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgQkVHSU5TOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgYiA9IHRvU3RyaW5nKGIpOyByZXR1cm4gYmVnaW5zT3AoYSwgYi5sZW5ndGgpID09PSBiOyB9LFxuICAgICAgICBtYWtlOiBmdW5jdGlvbihjKSB7IHJldHVybiB0aGlzLm1ha2VMSUtFKE5JTCwgTElLRV9XSUxEX0NBUkQsIExJS0UsICdCRUdJTlMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIEJFR0lOUyc6IHtcbiAgICAgICAgdGVzdDogZnVuY3Rpb24oYSwgYikgeyBiID0gdG9TdHJpbmcoYik7IHJldHVybiBiZWdpbnNPcChhLCBiLmxlbmd0aCkgIT09IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTklMLCBMSUtFX1dJTERfQ0FSRCwgTk9UX0xJS0UsICdOT1QgQkVHSU5TJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfSxcblxuICAgIC8qKiBAdHlwZSB7cmVsYXRpb25hbE9wZXJhdG9yfVxuICAgICAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHMjXG4gICAgICovXG4gICAgRU5EUzoge1xuICAgICAgICB0ZXN0OiBmdW5jdGlvbihhLCBiKSB7IGIgPSB0b1N0cmluZyhiKTsgcmV0dXJuIGVuZHNPcChhLCBiLmxlbmd0aCkgPT09IGI7IH0sXG4gICAgICAgIG1ha2U6IGZ1bmN0aW9uKGMpIHsgcmV0dXJuIHRoaXMubWFrZUxJS0UoTElLRV9XSUxEX0NBUkQsIE5JTCwgTElLRSwgJ0VORFMnLCBjKTsgfSxcbiAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlIHtyZWxhdGlvbmFsT3BlcmF0b3J9XG4gICAgICogQG1lbWJlck9mIENvbmRpdGlvbmFscyNcbiAgICAgKi9cbiAgICAnTk9UIEVORFMnOiB7XG4gICAgICAgIHRlc3Q6IGZ1bmN0aW9uKGEsIGIpIHsgYiA9IHRvU3RyaW5nKGIpOyByZXR1cm4gZW5kc09wKGEsIGIubGVuZ3RoKSAhPT0gYjsgfSxcbiAgICAgICAgbWFrZTogZnVuY3Rpb24oYykgeyByZXR1cm4gdGhpcy5tYWtlTElLRShMSUtFX1dJTERfQ0FSRCwgTklMLCBOT1RfTElLRSwgJ05PVCBFTkRTJywgYyk7IH0sXG4gICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgfVxufTtcblxuLy8gc29tZSBzeW5vbnltc1xub3BzWydcXHUyMjY0J10gPSBvcHNbJzw9J107ICAvLyBVTklDT0RFICdMRVNTLVRIQU4gT1IgRVFVQUwgVE8nXG5vcHNbJ1xcdTIyNjUnXSA9IG9wc1snPj0nXTsgIC8vIFVOSUNPREUgJ0dSRUFURVItVEhBTiBPUiBFUVVBTCBUTydcbm9wc1snXFx1MjI2MCddID0gb3BzWyc8PiddOyAgLy8gVU5JQ09ERSAnTk9UIEVRVUFMIFRPJ1xuXG5mdW5jdGlvbiBpbk9wKGEsIGIpIHtcbiAgICByZXR1cm4gYlxuICAgICAgICAudHJpbSgpIC8vIHJlbW92ZSBsZWFkaW5nIGFuZCB0cmFpbGluZyBzcGFjZSBjaGFyc1xuICAgICAgICAucmVwbGFjZSgvXFxzKixcXHMqL2csICcsJykgLy8gcmVtb3ZlIGFueSB3aGl0ZS1zcGFjZSBjaGFycyBmcm9tIGFyb3VuZCBjb21tYXNcbiAgICAgICAgLnNwbGl0KCcsJykgLy8gcHV0IGluIGFuIGFycmF5XG4gICAgICAgIC5pbmRleE9mKChhICsgJycpKTsgLy8gc2VhcmNoIGFycmF5IHdob2xlIG1hdGNoZXNcbn1cblxuZnVuY3Rpb24gY29udGFpbnNPcChhLCBiKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nKGEpLmluZGV4T2YodG9TdHJpbmcoYikpO1xufVxuXG5mdW5jdGlvbiBiZWdpbnNPcChhLCBsZW5ndGgpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcoYSkuc3Vic3RyKDAsIGxlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIGVuZHNPcChhLCBsZW5ndGgpIHtcbiAgICByZXR1cm4gdG9TdHJpbmcoYSkuc3Vic3RyKC1sZW5ndGgsIGxlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIHNxRXNjKHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvJy9nLCAnXFwnXFwnJyk7XG59XG5cbnZhciBncm91cHMgPSB7XG4gICAgZXF1YWxpdHk6IHtcbiAgICAgICAgbGFiZWw6ICdFcXVhbGl0eScsXG4gICAgICAgIHN1Ym1lbnU6IFsnPSddXG4gICAgfSxcbiAgICBpbmVxdWFsaXRpZXM6IHtcbiAgICAgICAgbGFiZWw6ICdJbmVxdWFsaXRpZXMnLFxuICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAnPCcsXG4gICAgICAgICAgICAnXFx1MjI2NCcsIC8vIFVOSUNPREUgJ0xFU1MtVEhBTiBPUiBFUVVBTCBUTyc7IG9uIGEgTWFjLCB0eXBlIG9wdGlvbi1jb21tYSAo4omkKVxuICAgICAgICAgICAgJ1xcdTIyNjAnLCAvLyBVTklDT0RFICdOT1QgRVFVQUxTJzsgb24gYSBNYWMsIHR5cGUgb3B0aW9uLWVxdWFscyAo4omgKVxuICAgICAgICAgICAgJ1xcdTIyNjUnLCAvLyBVTklDT0RFICdHUkVBVEVSLVRIQU4gT1IgRVFVQUwgVE8nOyBvbiBhIE1hYywgdHlwZSBvcHRpb24tcGVyaW9kICjiiaUpXG4gICAgICAgICAgICAnPidcbiAgICAgICAgXVxuICAgIH0sXG4gICAgc2V0czoge1xuICAgICAgICBsYWJlbDogJ1NldCBzY2FucycsXG4gICAgICAgIHN1Ym1lbnU6IFsnSU4nLCAnTk9UIElOJ11cbiAgICB9LFxuICAgIHN0cmluZ3M6IHtcbiAgICAgICAgbGFiZWw6ICdTdHJpbmcgc2NhbnMnLFxuICAgICAgICBzdWJtZW51OiBbXG4gICAgICAgICAgICAnQ09OVEFJTlMnLCAnTk9UIENPTlRBSU5TJyxcbiAgICAgICAgICAgICdCRUdJTlMnLCAnTk9UIEJFR0lOUycsXG4gICAgICAgICAgICAnRU5EUycsICdOT1QgRU5EUydcbiAgICAgICAgXVxuICAgIH0sXG4gICAgcGF0dGVybnM6IHtcbiAgICAgICAgbGFiZWw6ICdQYXR0ZXJuIHNjYW5zJyxcbiAgICAgICAgc3VibWVudTogWydMSUtFJywgJ05PVCBMSUtFJ11cbiAgICB9XG59O1xuXG4vLyBhZGQgYSBgbmFtZWAgcHJvcCB0byBlYWNoIGdyb3VwXG5fKGdyb3VwcykuZWFjaChmdW5jdGlvbihncm91cCwga2V5KSB7IGdyb3VwLm5hbWUgPSBrZXk7IH0pO1xuXG4vKipcbiAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHNcbiAqL1xuQ29uZGl0aW9uYWxzLmdyb3VwcyA9IGdyb3VwcztcblxuLyoqIERlZmF1bHQgb3BlcmF0b3IgbWVudSB3aGVuIGNvbnNpc3Rpbmcgb2YgYWxsIG9mIHRoZSBncm91cHMgaW4ge0BsaW5rIG1vZHVsZTpjb25kaXRpb25hbHMuZ3JvdXBzfGdyb3Vwc30uIFRoaXMgbWVudSBpcyB1c2VkIHdoZW4gbm9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIG90aGVyd2lzZSBkZWZpbmVkOlxuICogKiBUaGUgYG9wTWVudWAgcHJvcGVydHkgb2YgdGhlIGNvbHVtbiBzY2hlbWEuXG4gKiAqIFRoZSBlbnRyeSBpbiB0aGUgbm9kZSdzIGB0eXBlT3BNYXBgIGhhc2ggY29ycmVzcG9uZGluZyB0byB0aGUgYHR5cGVgIHByb3BlcnR5IG9mIHRoZSBjb2x1bW4gc2NoZW1hLlxuICogKiBUaGUgbm9kZSdzIGB0cmVlT3BNZW51YCBvYmplY3QuXG4gKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAqIEBtZW1iZXJPZiBDb25kaXRpb25hbHNcbiAqL1xuQ29uZGl0aW9uYWxzLmRlZmF1bHRPcE1lbnUgPSBbIC8vIGhpZXJhcmNoaWNhbCBtZW51IG9mIHJlbGF0aW9uYWwgb3BlcmF0b3JzXG4gICAgZ3JvdXBzLmVxdWFsaXR5LFxuICAgIGdyb3Vwcy5pbmVxdWFsaXRpZXMsXG4gICAgZ3JvdXBzLnNldHMsXG4gICAgZ3JvdXBzLnN0cmluZ3MsXG4gICAgZ3JvdXBzLnBhdHRlcm5zXG5dO1xuXG5cbi8vIE1lYW50IHRvIGJlIGNhbGxlZCBieSBGaWx0ZXJUcmVlLnByb3RvdHlwZS5zZXRTZW5zaXRpdml0eSBvbmx5XG5Db25kaXRpb25hbHMuc2V0VG9TdHJpbmcgPSBmdW5jdGlvbihmbikge1xuICAgIHJldHVybiAodG9TdHJpbmcgPSBmbik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbmRpdGlvbmFscztcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuLyogZXNsaW50LWRpc2FibGUga2V5LXNwYWNpbmcgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBGaWx0ZXJOb2RlID0gcmVxdWlyZSgnLi9GaWx0ZXJOb2RlJyk7XG52YXIgQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi9Db25kaXRpb25hbHMnKTtcblxuXG52YXIgdG9TdHJpbmc7IC8vIHNldCBieSBGaWx0ZXJMZWFmLnNldFRvU3RyaW5nKCkgY2FsbGVkIGZyb20gLi4vaW5kZXguanNcblxuXG4vKiogQHR5cGVkZWYge29iamVjdH0gY29udmVydGVyXG4gKiBAcHJvcGVydHkge2Z1bmN0aW9ufSB0b1R5cGUgLSBSZXR1cm5zIGlucHV0IHZhbHVlIGNvbnZlcnRlZCB0byB0eXBlLiBGYWlscyBzaWxlbnRseS5cbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IGZhaWxlZCAtIFRlc3RzIGlucHV0IHZhbHVlIGFnYWluc3QgdHlwZSwgcmV0dXJuaW5nIGBmYWxzZSBpZiB0eXBlIG9yIGB0cnVlYCBpZiBub3QgdHlwZS5cbiAqL1xuXG4vKiogQHR5cGUge2NvbnZlcnRlcn0gKi9cbnZhciBudW1iZXJDb252ZXJ0ZXIgPSB7XG4gICAgdG9UeXBlOiBOdW1iZXIsXG4gICAgZmFpbGVkOiBpc05hTlxufTtcblxuLyoqIEB0eXBlIHtjb252ZXJ0ZXJ9ICovXG52YXIgZGF0ZUNvbnZlcnRlciA9IHtcbiAgICB0b1R5cGU6IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIG5ldyBEYXRlKHMpOyB9LFxuICAgIGZhaWxlZDogaXNOYU5cbn07XG5cbi8qKlxuICogQHR5cGVkZWYge29iamVjdH0gZmlsdGVyTGVhZlZpZXdPYmplY3RcbiAqXG4gKiBAcHJvcGVydHkge0hUTUxFbGVtZW50fSBjb2x1bW4gLSBBIGRyb3AtZG93biB3aXRoIG9wdGlvbnMgZnJvbSB0aGUgYEZpbHRlckxlYWZgIGluc3RhbmNlJ3Mgc2NoZW1hLiBWYWx1ZSBpcyB0aGUgbmFtZSBvZiB0aGUgY29sdW1uIGJlaW5nIHRlc3RlZCAoaS5lLiwgdGhlIGNvbHVtbiB0byB3aGljaCB0aGlzIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24gYXBwbGllcykuXG4gKlxuICogQHByb3BlcnR5IG9wZXJhdG9yIC0gQSBkcm9wLWRvd24gd2l0aCBvcHRpb25zIGZyb20ge0BsaW5rIGNvbHVtbk9wTWVudX0sIHtAbGluayB0eXBlT3BNYXB9LCBvciB7QGxpbmsgdHJlZU9wTWVudX0uIFZhbHVlIGlzIHRoZSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9wZXJhdG9yLlxuICpcbiAqIEBwcm9wZXJ0eSBvcGVyYW5kIC0gQW4gaW5wdXQgZWxlbWVudCwgc3VjaCBhcyBhIGRyb3AtZG93biBvciBhIHRleHQgYm94LlxuICovXG5cbi8qKiBAY29uc3RydWN0b3JcbiAqIEBzdW1tYXJ5IEFuIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgYSBjb25kaXRpb25hbCBleHByZXNzaW9uIG5vZGUgaW4gYSBmaWx0ZXIgdHJlZS5cbiAqIEBkZXNjIFRoaXMgb2JqZWN0IHJlcHJlc2VudHMgYSBjb25kaXRpb25hbCBleHByZXNzaW9uLiBJdCBpcyBhbHdheXMgYSB0ZXJtaW5hbCBub2RlIGluIHRoZSBmaWx0ZXIgdHJlZTsgaXQgaGFzIG5vIGNoaWxkIG5vZGVzIG9mIGl0cyBvd24uXG4gKlxuICogQSBjb25kaXRpb25hbCBleHByZXNzaW9uIGlzIGEgc2ltcGxlIGR5YWRpYyBleHByZXNzaW9uIHdpdGggdGhlIGZvbGxvd2luZyBzeW50YXggaW4gdGhlIFVJOlxuICpcbiAqID4gX2NvbHVtbiBvcGVyYXRvciBvcGVyYW5kX1xuICpcbiAqIHdoZXJlOlxuICogKiBfY29sdW1uXyBpcyB0aGUgbmFtZSBvZiBhIGNvbHVtbiBmcm9tIHRoZSBkYXRhIHJvdyBvYmplY3RcbiAqICogX29wZXJhdG9yXyBpcyB0aGUgbmFtZSBvZiBhbiBvcGVyYXRvciBmcm9tIHRoZSBub2RlJ3Mgb3BlcmF0b3IgbGlzdFxuICogKiBfb3BlcmFuZF8gaXMgYSBsaXRlcmFsIHZhbHVlIHRvIGNvbXBhcmUgYWdhaW5zdCB0aGUgdmFsdWUgaW4gdGhlIG5hbWVkIGNvbHVtblxuICpcbiAqICoqTk9URToqKiBUaGUge0BsaW5rIENvbHVtbkxlYWZ9IGV4dGVuc2lvbiBvZiB0aGlzIG9iamVjdCBoYXMgYSBkaWZmZXJlbnQgaW1wbGVtZW50YXRpb24gb2YgX29wZXJhbmRfIHdoaWNoIGlzOiBUaGUgbmFtZSBvZiBhIGNvbHVtbiBmcm9tIHdoaWNoIHRvIGZldGNoIHRoZSBjb21wYXJlIHZhbHVlIChmcm9tIHRoZSBzYW1lIGRhdGEgcm93IG9iamVjdCkgdG8gY29tcGFyZSBhZ2FpbnN0IHRoZSB2YWx1ZSBpbiB0aGUgbmFtZWQgY29sdW1uLiBTZWUgKkV4dGVuZGluZyB0aGUgY29uZGl0aW9uYWwgZXhwcmVzc2lvbiBvYmplY3QqIGluIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvaW5kZXguaHRtbHxyZWFkbWV9LlxuICpcbiAqIFRoZSB2YWx1ZXMgb2YgdGhlIHRlcm1zIG9mIHRoZSBleHByZXNzaW9uIGFib3ZlIGFyZSBzdG9yZWQgaW4gdGhlIGZpcnN0IHRocmVlIHByb3BlcnRpZXMgYmVsb3cuIEVhY2ggb2YgdGhlc2UgdGhyZWUgcHJvcGVydGllcyBpcyBzZXQgZWl0aGVyIGJ5IGBzZXRTdGF0ZSgpYCBvciBieSB0aGUgdXNlciB2aWEgYSBjb250cm9sIGluIGBlbGAuIE5vdGUgdGhhdCB0aGVzZSBwcm9wZXJ0aWVzIGFyZSBub3QgZHluYW1pY2FsbHkgYm91bmQgdG8gdGhlIFVJIGNvbnRyb2xzOyB0aGV5IGFyZSB1cGRhdGVkIGJ5IHRoZSB2YWxpZGF0aW9uIGZ1bmN0aW9uLCBgaW52YWxpZCgpYC5cbiAqXG4gKiAqKlNlZSBhbHNvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzdXBlcmNsYXNzOioqIHtAbGluayBGaWx0ZXJOb2RlfVxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjb2x1bW4gLSBOYW1lIG9mIHRoZSBtZW1iZXIgaW4gdGhlIGRhdGEgcm93IG9iamVjdHMgYWdhaW5zdCB3aGljaCBgb3BlcmFuZGAgd2lsbCBiZSBjb21wYXJlZC4gUmVmbGVjdHMgdGhlIHZhbHVlIG9mIHRoZSBgdmlldy5jb2x1bW5gIGNvbnRyb2wgYWZ0ZXIgdmFsaWRhdGlvbi5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gb3BlcmF0b3IgLSBPcGVyYXRvciBzeW1ib2wuIFRoaXMgbXVzdCBtYXRjaCBhIGtleSBpbiB0aGUgYHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzYCBoYXNoLiBSZWZsZWN0cyB0aGUgdmFsdWUgb2YgdGhlIGB2aWV3Lm9wZXJhdG9yYCBjb250cm9sIGFmdGVyIHZhbGlkYXRpb24uXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG9wZXJhbmQgLSBWYWx1ZSB0byBjb21wYXJlIGFnYWluc3QgdGhlIHRoZSBtZW1iZXIgb2YgZGF0YSByb3cgbmFtZWQgYnkgYGNvbHVtbmAuIFJlZmxlY3RzIHRoZSB2YWx1ZSBvZiB0aGUgYHZpZXcub3BlcmFuZGAgY29udHJvbCwgYWZ0ZXIgdmFsaWRhdGlvbi5cbiAqXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbmFtZSAtIFVzZWQgdG8gZGVzY3JpYmUgdGhlIG9iamVjdCBpbiB0aGUgVUkgc28gdXNlciBjYW4gc2VsZWN0IGFuIGV4cHJlc3Npb24gZWRpdG9yLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZT0nc3RyaW5nJ10gLSBUaGUgZGF0YSB0eXBlIG9mIHRoZSBzdWJleHByZXNzaW9uIGlmIG5laXRoZXIgdGhlIG9wZXJhdG9yIG5vciB0aGUgY29sdW1uIHNjaGVtYSBkZWZpbmVzIGEgdHlwZS5cbiAqXG4gKiBAcHJvcGVydHkge0hUTUxFbGVtZW50fSBlbCAtIEEgYDxzcGFuPi4uLjwvc3Bhbj5gIGVsZW1lbnQgdGhhdCBjb250YWlucyB0aGUgVUkgY29udHJvbHMuIFRoaXMgZWxlbWVudCBpcyBhdXRvbWF0aWNhbGx5IGFwcGVuZWRlZCB0byB0aGUgcGFyZW50IGBGaWx0ZXJUcmVlYCdzIGBlbGAuIEdlbmVyYXRlZCBieSB7QGxpbmsgRmlsdGVyTGVhZiNjcmVhdGVWaWV3fGNyZWF0ZVZpZXd9LlxuICpcbiAqIEBwcm9wZXJ0eSB7ZmlsdGVyTGVhZlZpZXdPYmplY3R9IHZpZXcgLSBBIGhhc2ggY29udGFpbmluZyBkaXJlY3QgcmVmZXJlbmNlcyB0byB0aGUgY29udHJvbHMgaW4gYGVsYC4gQWRkZWQgYnkge0BsaW5rIEZpbHRlckxlYWYjY3JlYXRlVmlld3xjcmVhdGVWaWV3fS5cbiAqL1xudmFyIEZpbHRlckxlYWYgPSBGaWx0ZXJOb2RlLmV4dGVuZCgnRmlsdGVyTGVhZicsIHtcblxuICAgIG5hbWU6ICdjb2x1bW4gPSB2YWx1ZScsIC8vIGRpc3BsYXkgc3RyaW5nIGZvciBkcm9wLWRvd25cblxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy52aWV3KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy52aWV3KSB7XG4gICAgICAgICAgICAgICAgdGhpcy52aWV3W2tleV0ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5vbkNoYW5nZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IENyZWF0ZSBhIG5ldyB2aWV3LlxuICAgICAqIEBkZXNjIFRoaXMgbmV3IFwidmlld1wiIGlzIGEgZ3JvdXAgb2YgSFRNTCBgRWxlbWVudGAgY29udHJvbHMgdGhhdCBjb21wbGV0ZWx5IGRlc2NyaWJlIHRoZSBjb25kaXRpb25hbCBleHByZXNzaW9uIHRoaXMgb2JqZWN0IHJlcHJlc2VudHMuIFRoaXMgbWV0aG9kIGNyZWF0ZXMgdGhlIHZpZXcsIHNldHRpbmcgYHRoaXMuZWxgIHRvIHBvaW50IHRvIGl0LCBhbmQgdGhlIG1lbWJlcnMgb2YgYHRoaXMudmlld2AgdG8gcG9pbnQgdG8gdGhlIGluZGl2aWR1YWwgY29udHJvbHMgdGhlcmVpbi5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTGVhZiNcbiAgICAgKi9cbiAgICBjcmVhdGVWaWV3OiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXG4gICAgICAgIGVsLmNsYXNzTmFtZSA9ICdmaWx0ZXItdHJlZS1lZGl0b3IgZmlsdGVyLXRyZWUtZGVmYXVsdCc7XG5cbiAgICAgICAgaWYgKHN0YXRlICYmIHN0YXRlLmNvbHVtbikge1xuICAgICAgICAgICAgLy8gU3RhdGUgaW5jbHVkZXMgY29sdW1uOlxuICAgICAgICAgICAgLy8gT3BlcmF0b3IgbWVudSBpcyBidWlsdCBsYXRlciBpbiBsb2FkU3RhdGU7IHdlIGRvbid0IG5lZWQgdG8gYnVpbGQgaXQgbm93LiBUaGUgY2FsbCB0b1xuICAgICAgICAgICAgLy8gZ2V0T3BNZW51IGJlbG93IHdpdGggdW5kZWZpbmVkIGNvbHVtbk5hbWUgcmV0dXJucyBbXSByZXN1bHRpbmcgaW4gYW4gZW1wdHkgZHJvcC1kb3duLlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gV2hlbiBzdGF0ZSBkb2VzIE5PVCBpbmNsdWRlIGNvbHVtbiwgaXQncyBiZWNhdXNlIGVpdGhlcjpcbiAgICAgICAgICAgIC8vIGEuIGNvbHVtbiBpcyB1bmtub3duIGFuZCBvcCBtZW51IHdpbGwgYmUgZW1wdHkgdW50aWwgdXNlciBjaG9vc2VzIGEgY29sdW1uOyBvclxuICAgICAgICAgICAgLy8gYi4gY29sdW1uIGlzIGhhcmQtY29kZWQgd2hlbiB0aGVyZSdzIG9ubHkgb25lIHBvc3NpYmxlIGNvbHVtbiBhcyBpbmZlcmFibGUgZnJvbSBzY2hlbWE6XG4gICAgICAgICAgICB2YXIgc2NoZW1hID0gdGhpcy5zY2hlbWEgJiYgdGhpcy5zY2hlbWEubGVuZ3RoID09PSAxICYmIHRoaXMuc2NoZW1hWzBdLFxuICAgICAgICAgICAgICAgIGNvbHVtbk5hbWUgPSBzY2hlbWEgJiYgc2NoZW1hLm5hbWUgfHwgc2NoZW1hO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy52aWV3ID0ge1xuICAgICAgICAgICAgY29sdW1uOiB0aGlzLm1ha2VFbGVtZW50KHRoaXMuc2NoZW1hLCAnY29sdW1uJywgdGhpcy5zb3J0Q29sdW1uTWVudSksXG4gICAgICAgICAgICBvcGVyYXRvcjogdGhpcy5tYWtlRWxlbWVudChnZXRPcE1lbnUuY2FsbCh0aGlzLCBjb2x1bW5OYW1lKSwgJ29wZXJhdG9yJyksXG4gICAgICAgICAgICBvcGVyYW5kOiB0aGlzLm1ha2VFbGVtZW50KClcbiAgICAgICAgfTtcblxuICAgICAgICBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpKTtcbiAgICB9LFxuXG4gICAgbG9hZFN0YXRlOiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB2YXIgdmFsdWUsIGVsLCBpLCBiLCBzZWxlY3RlZCwgb3BzLCB0aGlzT3AsIG9wTWVudSwgbm90ZXM7XG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgbm90ZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzdGF0ZSkge1xuICAgICAgICAgICAgICAgIGlmICghRmlsdGVyTm9kZS5vcHRpb25zU2NoZW1hW2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzW2tleV0gPSBzdGF0ZVtrZXldO1xuICAgICAgICAgICAgICAgICAgICBlbCA9IHRoaXMudmlld1trZXldO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGVsLnR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ2NoZWNrYm94JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3JhZGlvJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2lucHV0W25hbWU9XFwnJyArIGVsLm5hbWUgKyAnXFwnXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBlbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbFtpXS5jaGVja2VkID0gdmFsdWUuaW5kZXhPZihlbFtpXS52YWx1ZSkgPj0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdzZWxlY3QtbXVsdGlwbGUnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsID0gZWwub3B0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwLCBiID0gZmFsc2U7IGkgPCBlbC5sZW5ndGg7IGkrKywgYiA9IGIgfHwgc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWQgPSB2YWx1ZS5pbmRleE9mKGVsW2ldLnZhbHVlKSA+PSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbFtpXS5zZWxlY3RlZCA9IHNlbGVjdGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCwgYik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVsLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVsLnZhbHVlID09PSAnJyAmJiBrZXkgPT09ICdvcGVyYXRvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3BlcmF0b3IgbWF5IGJlIGEgc3lub255bS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BzID0gdGhpcy5yb290LmNvbmRpdGlvbmFscy5vcHM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNPcCA9IG9wc1t2YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wTWVudSA9IGdldE9wTWVudS5jYWxsKHRoaXMsIHN0YXRlLmNvbHVtbiB8fCB0aGlzLmNvbHVtbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGVhY2ggbWVudSBpdGVtJ3Mgb3Agb2JqZWN0IGZvciBlcXVpdmFsZW5jeSB0byBwb3NzaWJsZSBzeW5vbnltJ3Mgb3Agb2JqZWN0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3BNZW51LndhbGsuY2FsbChvcE1lbnUsIGVxdWl2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXMucHVzaCh7IGtleToga2V5LCB2YWx1ZTogdmFsdWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09ICdjb2x1bW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ha2VPcE1lbnUuY2FsbCh0aGlzLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5vdGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZhciBtdWx0aXBsZSA9IG5vdGVzLmxlbmd0aCA+IDEsXG4gICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlcyA9IHRoaXMudGVtcGxhdGVzLFxuICAgICAgICAgICAgICAgICAgICBmb290bm90ZXMgPSB0ZW1wbGF0ZXMuZ2V0KG11bHRpcGxlID8gJ25vdGVzJyA6ICdub3RlJyksXG4gICAgICAgICAgICAgICAgICAgIGlubmVyID0gZm9vdG5vdGVzLnF1ZXJ5U2VsZWN0b3IoJy5mb290bm90ZScpO1xuICAgICAgICAgICAgICAgIG5vdGVzLmZvckVhY2goZnVuY3Rpb24obm90ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm9vdG5vdGUgPSBtdWx0aXBsZSA/IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJykgOiBpbm5lcjtcbiAgICAgICAgICAgICAgICAgICAgbm90ZSA9IHRlbXBsYXRlcy5nZXQoJ29wdGlvbk1pc3NpbmcnLCBub3RlLmtleSwgbm90ZS52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChub3RlLmxlbmd0aCkgeyBmb290bm90ZS5hcHBlbmRDaGlsZChub3RlWzBdKTsgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobXVsdGlwbGUpIHsgaW5uZXIuYXBwZW5kQ2hpbGQoZm9vdG5vdGUpOyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5vdGVzRWwgPSBmb290bm90ZXM7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gZXF1aXYob3BNZW51SXRlbSkge1xuICAgICAgICAgICAgdmFyIG9wTmFtZSA9IG9wTWVudUl0ZW0ubmFtZSB8fCBvcE1lbnVJdGVtO1xuICAgICAgICAgICAgaWYgKG9wc1tvcE5hbWVdID09PSB0aGlzT3ApIHtcbiAgICAgICAgICAgICAgICBlbC52YWx1ZSA9IG9wTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gbnVtYmVyXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IGludCAtIHN5bm9ueW0gb2YgYG51bWJlcmBcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gZmxvYXQgLSBzeW5vbnltIG9mIGBudW1iZXJgXG4gICAgICogQHByb3BlcnR5IHtjb252ZXJ0ZXJ9IGRhdGVcbiAgICAgKiBAcHJvcGVydHkge2NvbnZlcnRlcn0gc3RyaW5nXG4gICAgICovXG4gICAgY29udmVydGVyczoge1xuICAgICAgICBudW1iZXI6IG51bWJlckNvbnZlcnRlcixcbiAgICAgICAgaW50OiBudW1iZXJDb252ZXJ0ZXIsXG4gICAgICAgIGZsb2F0OiBudW1iZXJDb252ZXJ0ZXIsXG4gICAgICAgIGRhdGU6IGRhdGVDb252ZXJ0ZXJcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIGJ5IHRoZSBwYXJlbnQgbm9kZSdzIHtAbGluayBGaWx0ZXJUcmVlI2ludmFsaWR8aW52YWxpZCgpfSBtZXRob2QsIHdoaWNoIGNhdGNoZXMgdGhlIGVycm9yIHRocm93biB3aGVuIGludmFsaWQuXG4gICAgICpcbiAgICAgKiBBbHNvIHBlcmZvcm1zIHRoZSBmb2xsb3dpbmcgY29tcGlsYXRpb24gYWN0aW9uczpcbiAgICAgKiAqIENvcGllcyBhbGwgYHRoaXMudmlld2AnIHZhbHVlcyBmcm9tIHRoZSBET00gdG8gc2ltaWxhcmx5IG5hbWVkIHByb3BlcnRpZXMgb2YgYHRoaXNgLlxuICAgICAqICogUHJlLXNldHMgYHRoaXMub3BgIGFuZCBgdGhpcy5jb252ZXJ0ZXJgIGZvciB1c2UgaW4gYHRlc3RgJ3MgdHJlZSB3YWxrLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy50aHJvdz1mYWxzZV0gLSBUaHJvdyBhbiBlcnJvciBpZiBtaXNzaW5nIG9yIGludmFsaWQgdmFsdWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mb2N1cz1mYWxzZV0gLSBNb3ZlIGZvY3VzIHRvIG9mZmVuZGluZyBjb250cm9sLlxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9IFRoaXMgaXMgdGhlIG5vcm1hbCByZXR1cm4gd2hlbiB2YWxpZDsgb3RoZXJ3aXNlIHRocm93cyBlcnJvciB3aGVuIGludmFsaWQuXG4gICAgICogQG1lbWJlck9mIEZpbHRlckxlYWYjXG4gICAgICovXG4gICAgaW52YWxpZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgZWxlbWVudE5hbWUsIHR5cGUsIGZvY3VzZWQ7XG5cbiAgICAgICAgZm9yIChlbGVtZW50TmFtZSBpbiB0aGlzLnZpZXcpIHtcbiAgICAgICAgICAgIHZhciBlbCA9IHRoaXMudmlld1tlbGVtZW50TmFtZV0sXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBjb250cm9sVmFsdWUoZWwpLnRyaW0oKTtcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHZhbHVlID09PSAnJyAmJiBlbGVtZW50TmFtZSA9PT0gJ29wZXJhdG9yJyAmJiAvLyBub3QgaW4gb3BlcmF0b3IgbWVudVxuICAgICAgICAgICAgICAgIHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdICYmIC8vIGJ1dCB2YWxpZCBpbiBvcGVyYXRvciBoYXNoXG4gICAgICAgICAgICAgICAgIWdldFByb3BlcnR5LmNhbGwodGhpcywgdGhpcy5jb2x1bW4sICdvcE11c3RCZUluTWVudScpIC8vIGFuZCBpcyBkb2Vzbid0IGhhdmUgdG8gYmUgaW4gbWVudSB0byBiZSB2YWxpZFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB0aGlzLm9wZXJhdG9yOyAvLyB1c2UgaXQgYXMgaXMgdGhlblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09ICcnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmb2N1c2VkICYmIG9wdGlvbnMgJiYgb3B0aW9ucy5mb2N1cykge1xuICAgICAgICAgICAgICAgICAgICBjbGlja0luKGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZm9jdXNlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudGhyb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuRXJyb3IoJ01pc3Npbmcgb3IgaW52YWxpZCAnICsgZWxlbWVudE5hbWUgKyAnIGluIGNvbmRpdGlvbmFsIGV4cHJlc3Npb24uIENvbXBsZXRlIHRoZSBleHByZXNzaW9uIG9yIHJlbW92ZSBpdC4nLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENvcHkgZWFjaCBjb250cm9scydzIHZhbHVlIGFzIGEgbmV3IHNpbWlsYXJseSBuYW1lZCBwcm9wZXJ0eSBvZiB0aGlzIG9iamVjdC5cbiAgICAgICAgICAgICAgICB0aGlzW2VsZW1lbnROYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vcCA9IHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdO1xuXG4gICAgICAgIHR5cGUgPSB0aGlzLmdldFR5cGUoKTtcblxuICAgICAgICB0aGlzLmNvbnZlcnRlciA9IHR5cGUgJiYgdHlwZSAhPT0gJ3N0cmluZycgJiYgdGhpcy5jb252ZXJ0ZXJzW3R5cGVdO1xuXG4gICAgICAgIHRoaXMuY2FsY3VsYXRvciA9IHRoaXMuZ2V0Q2FsY3VsYXRvcigpO1xuICAgIH0sXG5cbiAgICBnZXRUeXBlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3AudHlwZSB8fCBnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIHRoaXMuY29sdW1uLCAndHlwZScpO1xuICAgIH0sXG5cbiAgICBnZXRDYWxjdWxhdG9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGdldFByb3BlcnR5LmNhbGwodGhpcywgdGhpcy5jb2x1bW4sICdjYWxjdWxhdG9yJyk7XG4gICAgfSxcblxuICAgIHZhbE9yRnVuYzogZnVuY3Rpb24oZGF0YVJvdywgY29sdW1uTmFtZSwgY2FsY3VsYXRvcikge1xuICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICBpZiAoZGF0YVJvdykge1xuICAgICAgICAgICAgcmVzdWx0ID0gZGF0YVJvd1tjb2x1bW5OYW1lXTtcbiAgICAgICAgICAgIGNhbGN1bGF0b3IgPSAodHlwZW9mIHJlc3VsdClbMF0gPT09ICdmJyA/IHJlc3VsdCA6IGNhbGN1bGF0b3I7XG4gICAgICAgICAgICBpZiAoY2FsY3VsYXRvcikge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGNhbGN1bGF0b3IoZGF0YVJvdywgY29sdW1uTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdCB8fCByZXN1bHQgPT09IDAgfHwgcmVzdWx0ID09PSBmYWxzZSA/IHJlc3VsdCA6ICcnO1xuICAgIH0sXG5cbiAgICBwOiBmdW5jdGlvbihkYXRhUm93KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZhbE9yRnVuYyhkYXRhUm93LCB0aGlzLmNvbHVtbiwgdGhpcy5jYWxjdWxhdG9yKTtcbiAgICB9LFxuXG4gICAgLy8gVG8gYmUgb3ZlcnJpZGRlbiB3aGVuIG9wZXJhbmQgaXMgYSBjb2x1bW4gbmFtZSAoc2VlIGNvbHVtbnMuanMpLlxuICAgIHE6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcGVyYW5kO1xuICAgIH0sXG5cbiAgICB0ZXN0OiBmdW5jdGlvbihkYXRhUm93KSB7XG4gICAgICAgIHZhciBwLCBxLCAvLyB1bnR5cGVkIHZlcnNpb25zIG9mIGFyZ3NcbiAgICAgICAgICAgIFAsIFEsIC8vIHR5cGVkIHZlcnNpb25zIG9mIHAgYW5kIHFcbiAgICAgICAgICAgIGNvbnZlcnRlcjtcblxuICAgICAgICAvLyBUT0RPOiBJZiBhIGxpdGVyYWwgKGkuZS4sIHdoZW4gdGhpcy5xIGlzIG5vdCBvdmVycmlkZGVuKSwgcSBvbmx5IG5lZWRzIHRvIGJlIGZldGNoZWQgT05DRSBmb3IgYWxsIHJvd3NcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIChwID0gdGhpcy5wKGRhdGFSb3cpKSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAocSA9IHRoaXMucShkYXRhUm93KSkgPT09IHVuZGVmaW5lZFxuICAgICAgICApXG4gICAgICAgICAgICA/IGZhbHNlIC8vIGRhdGEgaW5hY2Nlc3NpYmxlIHNvIGV4Y2x1ZGUgcm93XG4gICAgICAgICAgICA6IChcbiAgICAgICAgICAgICAgICAoY29udmVydGVyID0gdGhpcy5jb252ZXJ0ZXIpICYmXG4gICAgICAgICAgICAgICAgIWNvbnZlcnRlci5mYWlsZWQoUCA9IGNvbnZlcnRlci50b1R5cGUocCkpICYmIC8vIGF0dGVtcHQgdG8gY29udmVydCBkYXRhIHRvIHR5cGVcbiAgICAgICAgICAgICAgICAhY29udmVydGVyLmZhaWxlZChRID0gY29udmVydGVyLnRvVHlwZShxKSlcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICA/IHRoaXMub3AudGVzdChQLCBRKSAvLyBib3RoIGNvbnZlcnNpb25zIHN1Y2Nlc3NmdWw6IGNvbXBhcmUgYXMgdHlwZXNcbiAgICAgICAgICAgICAgICA6IHRoaXMub3AudGVzdCh0b1N0cmluZyhwKSwgdG9TdHJpbmcocSkpOyAvLyBvbmUgb3IgYm90aCBjb252ZXJzaW9ucyBmYWlsZWQ6IGNvbXBhcmUgYXMgc3RyaW5nc1xuICAgIH0sXG5cbiAgICB0b0pTT046IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhdGUgPSB7fTtcbiAgICAgICAgaWYgKHRoaXMuZWRpdG9yKSB7XG4gICAgICAgICAgICBzdGF0ZS5lZGl0b3IgPSB0aGlzLmVkaXRvcjtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy52aWV3KSB7XG4gICAgICAgICAgICBzdGF0ZVtrZXldID0gdGhpc1trZXldO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnNjaGVtYSAhPT0gdGhpcy5wYXJlbnQuc2NoZW1hKSB7XG4gICAgICAgICAgICBzdGF0ZS5zY2hlbWEgPSB0aGlzLnNjaGVtYTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBgJ29iamVjdCdgIGFuZCBgJ0pTT04nYCBub3RlIHRoYXQgdGhlIHN1YnRyZWUncyB2ZXJzaW9uIG9mIGBnZXRTdGF0ZWAgd2lsbCBub3QgY2FsbCB0aGlzIGxlYWYgdmVyc2lvbiBvZiBgZ2V0U3RhdGVgIGJlY2F1c2UgdGhlIGZvcm1lciB1c2VzIGB1bnN0cnVuZ2lmeSgpYCBhbmQgYEpTT04uc3RyaW5naWZ5KClgLCByZXNwZWN0aXZlbHksIGJvdGggb2Ygd2hpY2ggcmVjdXJzZSBhbmQgY2FsbCBgdG9KU09OKClgIG9uIHRoZWlyIG93bi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucz0nb2JqZWN0J10gLSBTZWUgdGhlIHN1YnRyZWUgdmVyc2lvbiBvZiB7QGxpbmsgRmlsdGVyVHJlZSNnZXRTdGF0ZXxnZXRTdGF0ZX0gZm9yIG1vcmUgaW5mby5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJMZWFmI1xuICAgICAqL1xuICAgIGdldFN0YXRlOiBmdW5jdGlvbiBnZXRTdGF0ZShvcHRpb25zKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAnJyxcbiAgICAgICAgICAgIHN5bnRheCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggfHwgJ29iamVjdCc7XG5cbiAgICAgICAgc3dpdGNoIChzeW50YXgpIHtcbiAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6IC8vIHNlZSBub3RlIGFib3ZlXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdGhpcy50b0pTT04oKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0pTT04nOiAvLyBzZWUgbm90ZSBhYm92ZVxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIG9wdGlvbnMgJiYgb3B0aW9ucy5zcGFjZSkgfHwgJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdTUUwnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuZ2V0U3ludGF4KHRoaXMucm9vdC5jb25kaXRpb25hbHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgbWFrZVNxbE9wZXJhbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yb290LmNvbmRpdGlvbmFscy5tYWtlU3FsU3RyaW5nKHRoaXMub3BlcmFuZCk7IC8vIHRvZG86IHRoaXMgc2hvdWxkIGJlIGEgbnVtYmVyIGlmIHR5cGUgaXMgbnVtYmVyIGluc3RlYWQgb2YgYSBzdHJpbmcgLS0gYnV0IHdlIHdpbGwgaGF2ZSB0byBlbnN1cmUgaXQgaXMgbnVtZXJpYyFcbiAgICB9LFxuXG4gICAgZ2V0U3ludGF4OiBmdW5jdGlvbihjb25kaXRpb25hbHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucm9vdC5jb25kaXRpb25hbHMub3BzW3RoaXMub3BlcmF0b3JdLm1ha2UuY2FsbChjb25kaXRpb25hbHMsIHRoaXMpO1xuICAgIH0sXG5cbiAgICAvKiogQHN1bW1hcnkgSFRNTCBmb3JtIGNvbnRyb2xzIGZhY3RvcnkuXG4gICAgICogQGRlc2MgQ3JlYXRlcyBhbmQgYXBwZW5kcyBhIHRleHQgYm94IG9yIGEgZHJvcC1kb3duLlxuICAgICAqID4gRGVmaW5lZCBvbiB0aGUgRmlsdGVyVHJlZSBwcm90b3R5cGUgZm9yIGFjY2VzcyBieSBkZXJpdmVkIHR5cGVzIChhbHRlcm5hdGUgZmlsdGVyIGVkaXRvcnMpLlxuICAgICAqIEByZXR1cm5zIFRoZSBuZXcgZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge21lbnVJdGVtW119IFttZW51XSAtIE92ZXJsb2FkczpcbiAgICAgKiAqIElmIG9taXR0ZWQsIHdpbGwgY3JlYXRlIGFuIGA8aW5wdXQvPmAgKHRleHQgYm94KSBlbGVtZW50LlxuICAgICAqICogSWYgY29udGFpbnMgb25seSBhIHNpbmdsZSBvcHRpb24sIHdpbGwgY3JlYXRlIGEgYDxzcGFuPi4uLjwvc3Bhbj5gIGVsZW1lbnQgY29udGFpbmluZyB0aGUgc3RyaW5nIGFuZCBhIGA8aW5wdXQgdHlwZT1oaWRkZW4+YCBjb250YWluaW5nIHRoZSB2YWx1ZS5cbiAgICAgKiAqIE90aGVyd2lzZSwgY3JlYXRlcyBhIGA8c2VsZWN0Pi4uLjwvc2VsZWN0PmAgZWxlbWVudCB3aXRoIHRoZXNlIG1lbnUgaXRlbXMuXG4gICAgICogQHBhcmFtIHtudWxsfHN0cmluZ30gW3Byb21wdD0nJ10gLSBBZGRzIGFuIGluaXRpYWwgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50IHRvIHRoZSBkcm9wLWRvd24gd2l0aCB0aGlzIHZhbHVlLCBwYXJlbnRoZXNpemVkLCBhcyBpdHMgYHRleHRgOyBhbmQgZW1wdHkgc3RyaW5nIGFzIGl0cyBgdmFsdWVgLiBPbWl0dGluZyBjcmVhdGVzIGEgYmxhbmsgcHJvbXB0OyBgbnVsbGAgc3VwcHJlc3Nlcy5cbiAgICAgKiBAcGFyYW0gW3NvcnRdXG4gICAgICogQG1lbWJlck9mIEZpbHRlckxlYWYjXG4gICAgICovXG4gICAgbWFrZUVsZW1lbnQ6IGZ1bmN0aW9uKG1lbnUsIHByb21wdCwgc29ydCkge1xuICAgICAgICB2YXIgZWwsIHJlc3VsdCwgb3B0aW9ucyxcbiAgICAgICAgICAgIG9wdGlvbiA9IG1lbnUsXG4gICAgICAgICAgICB0YWdOYW1lID0gbWVudSA/ICdTRUxFQ1QnIDogJ0lOUFVUJztcblxuICAgICAgICAvLyBkZXRlcm1pbmUgaWYgdGhlcmUgd291bGQgYmUgb25seSBhIHNpbmdsZSBpdGVtIGluIHRoZSBkcm9wZG93blxuICAgICAgICB3aGlsZSAob3B0aW9uIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb24ubGVuZ3RoID09PSAxICYmICFwb3BNZW51LmlzR3JvdXBQcm94eShvcHRpb25bMF0pKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9uID0gb3B0aW9uWzBdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9uKSB7XG4gICAgICAgICAgICAvLyBoYXJkIHRleHQgd2hlbiBzaW5nbGUgaXRlbVxuICAgICAgICAgICAgZWwgPSB0aGlzLnRlbXBsYXRlcy5nZXQoXG4gICAgICAgICAgICAgICAgJ2xvY2tlZENvbHVtbicsXG4gICAgICAgICAgICAgICAgb3B0aW9uLmFsaWFzIHx8IG9wdGlvbi5oZWFkZXIgfHwgb3B0aW9uLm5hbWUgfHwgb3B0aW9uLFxuICAgICAgICAgICAgICAgIG9wdGlvbi5uYW1lIHx8IG9wdGlvbi5hbGlhcyB8fCBvcHRpb24uaGVhZGVyIHx8IG9wdGlvblxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGVsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHByb21wdDogcHJvbXB0LFxuICAgICAgICAgICAgICAgIHNvcnQ6IHNvcnQsXG4gICAgICAgICAgICAgICAgZ3JvdXA6IGZ1bmN0aW9uKGdyb3VwTmFtZSkgeyByZXR1cm4gQ29uZGl0aW9uYWxzLmdyb3Vwc1tncm91cE5hbWVdOyB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBtYWtlIGFuIGVsZW1lbnRcbiAgICAgICAgICAgIGVsID0gcG9wTWVudS5idWlsZCh0YWdOYW1lLCBtZW51LCBvcHRpb25zKTtcblxuICAgICAgICAgICAgLy8gaWYgaXQncyBhIHRleHRib3gsIGxpc3RlbiBmb3Iga2V5dXAgZXZlbnRzXG4gICAgICAgICAgICBpZiAoZWwudHlwZSA9PT0gJ3RleHQnICYmIHRoaXMuZXZlbnRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHRoaXMuZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIG9uY2hhbmdlIGV2ZW50c1xuICAgICAgICAgICAgdGhpcy5vbkNoYW5nZSA9IHRoaXMub25DaGFuZ2UgfHwgY2xlYW5VcEFuZE1vdmVPbi5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLm9uQ2hhbmdlKTtcblxuICAgICAgICAgICAgRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwpO1xuICAgICAgICAgICAgcmVzdWx0ID0gZWw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKGVsKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn0pO1xuXG4vKiogYGNoYW5nZWAgZXZlbnQgaGFuZGxlciBmb3IgYWxsIGZvcm0gY29udHJvbHMuXG4gKiBSZWJ1aWxkcyB0aGUgb3BlcmF0b3IgZHJvcC1kb3duIGFzIG5lZWRlZC5cbiAqIFJlbW92ZXMgZXJyb3IgQ1NTIGNsYXNzIGZyb20gY29udHJvbC5cbiAqIEFkZHMgd2FybmluZyBDU1MgY2xhc3MgZnJvbSBjb250cm9sIGlmIGJsYW5rOyByZW1vdmVzIGlmIG5vdCBibGFuay5cbiAqIEFkZHMgd2FybmluZyBDU1MgY2xhc3MgZnJvbSBjb250cm9sIGlmIGJsYW5rOyByZW1vdmVzIGlmIG5vdCBibGFuay5cbiAqIE1vdmVzIGZvY3VzIHRvIG5leHQgbm9uLWJsYW5rIHNpYmxpbmcgY29udHJvbC5cbiAqIEB0aGlzIHtGaWx0ZXJMZWFmfVxuICovXG5mdW5jdGlvbiBjbGVhblVwQW5kTW92ZU9uKGV2dCkge1xuICAgIHZhciBlbCA9IGV2dC50YXJnZXQ7XG5cbiAgICAvLyByZW1vdmUgYGVycm9yYCBDU1MgY2xhc3MsIHdoaWNoIG1heSBoYXZlIGJlZW4gYWRkZWQgYnkgYEZpbHRlckxlYWYucHJvdG90eXBlLmludmFsaWRgXG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZmlsdGVyLXRyZWUtZXJyb3InKTtcblxuICAgIC8vIHNldCBvciByZW1vdmUgJ3dhcm5pbmcnIENTUyBjbGFzcywgYXMgcGVyIGVsLnZhbHVlXG4gICAgRmlsdGVyTm9kZS5zZXRXYXJuaW5nQ2xhc3MoZWwpO1xuXG4gICAgaWYgKGVsID09PSB0aGlzLnZpZXcuY29sdW1uKSB7XG4gICAgICAgIC8vIHJlYnVpbGQgb3BlcmF0b3IgbGlzdCBhY2NvcmRpbmcgdG8gc2VsZWN0ZWQgY29sdW1uIG5hbWUgb3IgdHlwZSwgcmVzdG9yaW5nIHNlbGVjdGVkIGl0ZW1cbiAgICAgICAgbWFrZU9wTWVudS5jYWxsKHRoaXMsIGVsLnZhbHVlKTtcbiAgICB9XG5cbiAgICBpZiAoZWwudmFsdWUpIHtcbiAgICAgICAgLy8gZmluZCBuZXh0IHNpYmxpbmcgY29udHJvbCwgaWYgYW55XG4gICAgICAgIGlmICghZWwubXVsdGlwbGUpIHtcbiAgICAgICAgICAgIHdoaWxlICgoZWwgPSBlbC5uZXh0RWxlbWVudFNpYmxpbmcpICYmICghKCduYW1lJyBpbiBlbCkgfHwgZWwudmFsdWUudHJpbSgpICE9PSAnJykpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGN1cmx5XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbmQgY2xpY2sgaW4gaXQgKG9wZW5zIHNlbGVjdCBsaXN0KVxuICAgICAgICBpZiAoZWwgJiYgZWwudmFsdWUudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgZWwudmFsdWUgPSAnJzsgLy8gcmlkIG9mIGFueSB3aGl0ZSBzcGFjZVxuICAgICAgICAgICAgRmlsdGVyTm9kZS5jbGlja0luKGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZvcndhcmQgdGhlIGV2ZW50IHRvIHRoZSBhcHBsaWNhdGlvbidzIGV2ZW50IGhhbmRsZXJcbiAgICBpZiAodGhpcy5ldmVudEhhbmRsZXIpIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXIoZXZ0KTtcbiAgICB9XG59XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRoZSBub2RlIHByb3BlcnR5LlxuICogQGRlc2MgUHJpb3JpdHkgbGFkZGVyOlxuICogMS4gU2NoZW1hIHByb3BlcnR5LlxuICogMi4gTWl4aW4gKGlmIGdpdmVuKS5cbiAqIDMuIE5vZGUgcHJvcGVydHkgaXMgZmluYWwgcHJpb3JpdHkuXG4gKiBAdGhpcyB7RmlsdGVyTGVhZn1cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb2x1bW5OYW1lXG4gKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHlOYW1lXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufGJvb2xlYW59IFttaXhpbl0gLSBPcHRpb25hbCBmdW5jdGlvbiBvciB2YWx1ZSBpZiBzY2hlbWEgcHJvcGVydHkgdW5kZWZpbmVkLiBJZiBmdW5jdGlvbiwgY2FsbGVkIGluIGNvbnRleHQgd2l0aCBgcHJvcGVydHlOYW1lYCBhbmQgYGNvbHVtbk5hbWVgLlxuICogQHJldHVybnMge29iamVjdH1cbiAqL1xuZnVuY3Rpb24gZ2V0UHJvcGVydHkoY29sdW1uTmFtZSwgcHJvcGVydHlOYW1lLCBtaXhpbikge1xuICAgIHZhciBjb2x1bW5TY2hlbWEgPSB0aGlzLnNjaGVtYS5sb29rdXAoY29sdW1uTmFtZSkgfHwge307XG4gICAgcmV0dXJuIChcbiAgICAgICAgY29sdW1uU2NoZW1hW3Byb3BlcnR5TmFtZV0gLy8gdGhlIGV4cHJlc3Npb24ncyBjb2x1bW4gc2NoZW1hIHByb3BlcnR5XG4gICAgICAgICAgICB8fFxuICAgICAgICB0eXBlb2YgbWl4aW4gPT09ICdmdW5jdGlvbicgJiYgbWl4aW4uY2FsbCh0aGlzLCBjb2x1bW5TY2hlbWEsIHByb3BlcnR5TmFtZSlcbiAgICAgICAgICAgIHx8XG4gICAgICAgIHR5cGVvZiBtaXhpbiAhPT0gJ2Z1bmN0aW9uJyAmJiBtaXhpblxuICAgICAgICAgICAgfHxcbiAgICAgICAgdGhpc1twcm9wZXJ0eU5hbWVdIC8vIHRoZSBleHByZXNzaW9uIG5vZGUncyBwcm9wZXJ0eVxuICAgICk7XG59XG5cbi8qKlxuICogQHRoaXMge0ZpbHRlckxlYWZ9XG4gKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICogQHJldHVybnMge3VuZGVmaW5lZHxtZW51SXRlbVtdfVxuICovXG5mdW5jdGlvbiBnZXRPcE1lbnUoY29sdW1uTmFtZSkge1xuICAgIHJldHVybiBnZXRQcm9wZXJ0eS5jYWxsKHRoaXMsIGNvbHVtbk5hbWUsICdvcE1lbnUnLCBmdW5jdGlvbihjb2x1bW5TY2hlbWEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudHlwZU9wTWFwICYmIHRoaXMudHlwZU9wTWFwW2NvbHVtblNjaGVtYS50eXBlIHx8IHRoaXMudHlwZV07XG4gICAgfSk7XG59XG5cbi8qKlxuICogQHRoaXMge0ZpbHRlckxlYWZ9XG4gKiBAcGFyYW0ge3N0cmluZ30gY29sdW1uTmFtZVxuICovXG5mdW5jdGlvbiBtYWtlT3BNZW51KGNvbHVtbk5hbWUpIHtcbiAgICB2YXIgb3BNZW51ID0gZ2V0T3BNZW51LmNhbGwodGhpcywgY29sdW1uTmFtZSk7XG5cbiAgICBpZiAob3BNZW51ICE9PSB0aGlzLnJlbmRlcmVkT3BNZW51KSB7XG4gICAgICAgIHZhciBuZXdPcERyb3AgPSB0aGlzLm1ha2VFbGVtZW50KG9wTWVudSwgJ29wZXJhdG9yJyk7XG5cbiAgICAgICAgbmV3T3BEcm9wLnZhbHVlID0gdGhpcy52aWV3Lm9wZXJhdG9yLnZhbHVlO1xuICAgICAgICB0aGlzLmVsLnJlcGxhY2VDaGlsZChuZXdPcERyb3AsIHRoaXMudmlldy5vcGVyYXRvcik7XG4gICAgICAgIHRoaXMudmlldy5vcGVyYXRvciA9IG5ld09wRHJvcDtcblxuICAgICAgICBGaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyhuZXdPcERyb3ApO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZWRPcE1lbnUgPSBvcE1lbnU7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbGlja0luKGVsKSB7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZmlsdGVyLXRyZWUtZXJyb3InKTtcbiAgICAgICAgRmlsdGVyTm9kZS5jbGlja0luKGVsKTtcbiAgICB9LCAwKTtcbn1cblxuZnVuY3Rpb24gY29udHJvbFZhbHVlKGVsKSB7XG4gICAgdmFyIHZhbHVlLCBpO1xuXG4gICAgc3dpdGNoIChlbC50eXBlKSB7XG4gICAgICAgIGNhc2UgJ2NoZWNrYm94JzpcbiAgICAgICAgY2FzZSAncmFkaW8nOlxuICAgICAgICAgICAgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lPVxcJycgKyBlbC5uYW1lICsgJ1xcJ106ZW5hYmxlZDpjaGVja2VkJyk7XG4gICAgICAgICAgICBmb3IgKHZhbHVlID0gW10sIGkgPSAwOyBpIDwgZWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YWx1ZS5wdXNoKGVsW2ldLnZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgJ3NlbGVjdC1tdWx0aXBsZSc6XG4gICAgICAgICAgICBlbCA9IGVsLm9wdGlvbnM7XG4gICAgICAgICAgICBmb3IgKHZhbHVlID0gW10sIGkgPSAwOyBpIDwgZWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWVsLmRpc2FibGVkICYmIGVsLnNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLnB1c2goZWxbaV0udmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB2YWx1ZSA9IGVsLnZhbHVlO1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuLy8gTWVhbnQgdG8gYmUgY2FsbGVkIGJ5IEZpbHRlclRyZWUucHJvdG90eXBlLnNldFNlbnNpdGl2aXR5IG9ubHlcbkZpbHRlckxlYWYuc2V0VG9TdHJpbmcgPSBmdW5jdGlvbihmbikge1xuICAgIHRvU3RyaW5nID0gZm47XG4gICAgcmV0dXJuIENvbmRpdGlvbmFscy5zZXRUb1N0cmluZyhmbik7XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyTGVhZjtcbiIsIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfID0gcmVxdWlyZSgnb2JqZWN0LWl0ZXJhdG9ycycpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJ2V4dGVuZC1tZScpLCBCYXNlID0gZXh0ZW5kLkJhc2U7IGV4dGVuZC5kZWJ1ZyA9IHRydWU7XG52YXIgcG9wTWVudSA9IHJlcXVpcmUoJ3BvcC1tZW51Jyk7XG5cbnZhciBjc3NJbmplY3RvciA9IHJlcXVpcmUoJy4vc3R5bGVzaGVldCcpO1xudmFyIFRlbXBsYXRlcyA9IHJlcXVpcmUoJy4vVGVtcGxhdGVzJyk7XG52YXIgQ29uZGl0aW9uYWxzID0gcmVxdWlyZSgnLi9Db25kaXRpb25hbHMnKTtcbnZhciBQYXJzZXJTUUwgPSByZXF1aXJlKCcuL3BhcnNlci1TUUwnKTtcblxuXG52YXIgQ0hJTERSRU5fVEFHID0gJ09MJyxcbiAgICBDSElMRF9UQUcgPSAnTEknO1xuXG4vLyBKU09OLWRldGVjdG9yOiBiZWdpbnMgX2FuZF8gZW5kcyB3aXRoIGVpdGhlciBbIGFuZCBdIF9vcl8geyBhbmQgfVxudmFyIHJlSlNPTiA9IC9eXFxzKigoXFxbW15dKlxcXSl8KFxce1teXSpcXH0pKVxccyokLztcblxuZnVuY3Rpb24gRmlsdGVyVHJlZUVycm9yKG1lc3NhZ2UsIG5vZGUpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG59XG5GaWx0ZXJUcmVlRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuRmlsdGVyVHJlZUVycm9yLnByb3RvdHlwZS5uYW1lID0gJ0ZpbHRlclRyZWVFcnJvcic7XG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBbc3ludGF4PSdhdXRvJ10gLSBTcGVjaWZ5IHBhcnNlciB0byB1c2Ugb24gYHN0YXRlYC4gT25lIG9mOlxuICogKiBgJ2F1dG8nYCAtIEF1dG8tZGV0ZWN0OyBzZWUge0BsaW5rIEZpbHRlck5vZGUjcGFyc2VTdGF0ZVN0cmluZ30gZm9yIGFsZ29yaXRobS5cbiAqICogYCdvYmplY3QnYCAtIEEgcmF3IHN0YXRlIG9iamVjdCBzdWNoIGFzIHRoYXQgcHJvZHVjZWQgYnkgdGhlIFtnZXRTdGF0ZSgpXXtAbGluayBGaWx0ZXJUcmVlI2dldFN0YXRlfSBtZXRob2QuXG4gKiAqIGAnSlNPTidgIC0gQSBKU09OIHN0cmluZyB2ZXJzaW9uIG9mIGEgc3RhdGUgb2JqZWN0IHN1Y2ggYXMgdGhhdCBwcm9kdWNlZCBieSB0aGUgW2dldFN0YXRlKClde0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV9IG1ldGhvZC5cbiAqICogYCdTUUwnYCAtIEEgU1FMIFtzZWFyY2ggY29uZGl0aW9uIGV4cHJlc3Npb25de0BsaW5rIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxNzM1NDUuYXNweH0gc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gW2NvbnRleHRdIElmIGRlZmluZWQsIHRoZSBwcm92aWRlZCBpbnB1dCBzdHJpbmcgaXMgdXNlZCBhcyBhIHNlbGVjdG9yIHRvIGFuIGBIVE1MRWxlbWVudGAgY29udGFpbmVkIGluIGBjb250ZXh0YC4gVGhlIGB2YWx1ZWAgcHJvcGVydHkgb2YgdGhpcyBlbGVtZW50IGlzIGZldGNoZWQgZnJvbSB0aGUgRE9NIGFuZCBpcyB1c2VkIGFzIHRoZSBpbnB1dCBzdGF0ZSBzdHJpbmc7IHByb2NlZWQgYXMgYWJvdmUuXG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVPcHRpb25zT2JqZWN0XG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbc2NoZW1hXSAtIEEgZGVmYXVsdCBsaXN0IG9mIGNvbHVtbiBuYW1lcyBmb3IgZmllbGQgZHJvcC1kb3ducyBvZiBhbGwgZGVzY2VuZGFudCB0ZXJtaW5hbCBub2Rlcy4gT3ZlcnJpZGVzIGBvcHRpb25zLnN0YXRlLnNjaGVtYWAgKHNlZSkuIE1heSBiZSBkZWZpbmVkIGZvciBhbnkgbm9kZSBhbmQgcGVydGFpbnMgdG8gYWxsIGRlc2NlbmRhbnRzIG9mIHRoYXQgbm9kZSAoaW5jbHVkaW5nIHRlcm1pbmFsIG5vZGVzKS4gSWYgb21pdHRlZCAoYW5kIG5vIGBvd25TY2hlbWFgKSwgd2lsbCB1c2UgdGhlIG5lYXJlc3QgYW5jZXN0b3IgYHNjaGVtYWAgZGVmaW5pdGlvbi4gSG93ZXZlciwgZGVzY2VuZGFudHMgd2l0aCB0aGVpciBvd24gZGVmaW5pdGlvbiBvZiBgdHlwZXNgIHdpbGwgb3ZlcnJpZGUgYW55IGFuY2VzdG9yIGRlZmluaXRpb24uXG4gKlxuICogPiBUeXBpY2FsbHkgb25seSB1c2VkIGJ5IHRoZSBjYWxsZXIgZm9yIHRoZSB0b3AtbGV2ZWwgKHJvb3QpIHRyZWUuXG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbb3duU2NoZW1hXSAtIEEgZGVmYXVsdCBsaXN0IG9mIGNvbHVtbiBuYW1lcyBmb3IgZmllbGQgZHJvcC1kb3ducyBvZiBpbW1lZGlhdGUgZGVzY2VuZGFudCB0ZXJtaW5hbCBub2RlcyBfb25seV8uIE92ZXJyaWRlcyBgb3B0aW9ucy5zdGF0ZS5vd25TY2hlbWFgIChzZWUpLlxuICpcbiAqIEFsdGhvdWdoIGJvdGggYG9wdGlvbnMuc2NoZW1hYCBhbmQgYG9wdGlvbnMub3duU2NoZW1hYCBhcmUgbm90YXRlZCBhcyBvcHRpb25hbCBoZXJlaW4sIGJ5IHRoZSB0aW1lIGEgdGVybWluYWwgbm9kZSB0cmllcyB0byByZW5kZXIgYSBzY2hlbWEgZHJvcC1kb3duLCBhIGBzY2hlbWFgIGxpc3Qgc2hvdWxkIGJlIGRlZmluZWQgdGhyb3VnaCAoaW4gb3JkZXIgb2YgcHJpb3JpdHkpOlxuICpcbiAqICogVGVybWluYWwgbm9kZSdzIG93biBgb3B0aW9ucy5zY2hlbWFgIChvciBgb3B0aW9ucy5zdGF0ZS5zY2hlbWFgKSBkZWZpbml0aW9uLlxuICogKiBUZXJtaW5hbCBub2RlJ3MgcGFyZW50IG5vZGUncyBgb3B0aW9uLm93blNjaGVtYWAgKG9yIGBvcHRpb24uc3RhdGUubm9kZXNGaWVsZHNgKSBkZWZpbml0aW9uLlxuICogKiBUZXJtaW5hbCBub2RlJ3MgcGFyZW50IChvciBhbnkgYW5jZXN0b3IpIG5vZGUncyBgb3B0aW9ucy5zY2hlbWFgIChvciBgb3B0aW9ucy5zdGF0ZS5zY2hlbWFgKSBkZWZpbml0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBbc3RhdGVdIC0gQSBkYXRhIHN0cnVjdHVyZSB0aGF0IGRlc2NyaWJlcyBhIHRyZWUsIHN1YnRyZWUsIG9yIGxlYWYgKHRlcm1pbmFsIG5vZGUpLiBJZiB1bmRlZmluZWQsIGxvYWRzIGFuIGVtcHR5IGZpbHRlciwgd2hpY2ggaXMgYSBgRmlsdGVyVHJlZWAgbm9kZSBjb25zaXN0aW5nIHRoZSBkZWZhdWx0IGBvcGVyYXRvcmAgdmFsdWUgKGAnb3AtYW5kJ2ApLlxuICpcbiAqIEBwcm9wZXJ0eSB7ZnVuY3Rpb259IFtlZGl0b3I9J0RlZmF1bHQnXSAtIFRoZSBuYW1lIG9mIHRoZSBjb25kaXRpb25hbCBleHByZXNzaW9uJ3MgVUkgXCJlZGl0b3IuXCIgVGhpcyBuYW1lIG11c3QgYmUgcmVnaXN0ZXJlZCBpbiB0aGUgcGFyZW50IG5vZGUncyB7QGxpbmsgRmlsdGVyVHJlZSNlZGl0b3JzfGVkaXRvcnN9IGhhc2gsIHdoZXJlIGl0IG1hcHMgdG8gYSBsZWFmIGNvbnN0cnVjdG9yIChgRmlsdGVyTGVhZmAgb3IgYSBkZXNjZW5kYW50IHRoZXJlb2YpLiAoVXNlIHtAbGluayBGaWx0ZXJUcmVlI2FkZEVkaXRvcn0gdG8gcmVnaXN0ZXIgbmV3IGVkaXRvcnMuKVxuICpcbiAqIEBwcm9wZXJ0eSB7RmlsdGVyVHJlZX0gW3BhcmVudF0gLSBVc2VkIGludGVybmFsbHkgdG8gaW5zZXJ0IGVsZW1lbnQgd2hlbiBjcmVhdGluZyBuZXN0ZWQgc3VidHJlZXMuIFRoZSBvbmx5IHRpbWUgaXQgbWF5IGJlIChhbmQgbXVzdCBiZSkgb21pdHRlZCBpcyB3aGVuIGNyZWF0aW5nIHRoZSByb290IG5vZGUuXG4gKlxuICogQHByb3BlcnR5IHtzdHJpbmd8SFRNTEVsZW1lbnR9IFtjc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudF0gLSBwYXNzZWQgdG8gY3NzSW5zZXJ0XG4gKi9cblxuLyoqIEB0eXBlZGVmIHtvYmplY3R8c3RyaW5nfSBGaWx0ZXJUcmVlU3RhdGVPYmplY3RcbiAqXG4gKiBAc3VtbWFyeSBTdGF0ZSB3aXRoIHdoaWNoIHRvIGNyZWF0ZSBhIG5ldyBub2RlIG9yIHJlcGxhY2UgYW4gZXhpc3Rpbmcgbm9kZS5cbiAqXG4gKiBAZGVzYyBBIHN0cmluZyBvciBwbGFpbiBvYmplY3QgdGhhdCBkZXNjcmliZXMgYSBmaWx0ZXItdHJlZSBub2RlLiBJZiBhIHN0cmluZywgaXQgaXMgcGFyc2VkIGludG8gYW4gb2JqZWN0IGJ5IHtAbGluayBGaWx0ZXJOb2RlfnBhcnNlU3RhdGVTdHJpbmd9LiAoU2VlLCBmb3IgYXZhaWxhYmxlIG92ZXJsb2Fkcy4pXG4gKlxuICogVGhlIHJlc3VsdGluZyBvYmplY3QgbWF5IGJlIGEgZmxhdCBvYmplY3QgdGhhdCBkZXNjcmliZXMgYSB0ZXJtaW5hbCBub2RlIG9yIGEgY2hpbGRsZXNzIHJvb3Qgb3IgYnJhbmNoIG5vZGU7IG9yIG1heSBiZSBhIGhpZXJhcmNoaWNhbCBvYmplY3QgdG8gZGVmaW5lIGFuIGVudGlyZSB0cmVlIG9yIHN1YnRyZWUuXG4gKlxuICogSW4gYW55IGNhc2UsIHRoZSByZXN1bHRpbmcgb2JqZWN0IG1heSBoYXZlIGFueSBvZiB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gKlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBbc2NoZW1hXSAtIFNlZSBgc2NoZW1hYCBwcm9wZXJ0eSBvZiB7QGxpbmsgRmlsdGVyVHJlZU9wdGlvbnNPYmplY3R9LlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbZWRpdG9yPSdEZWZhdWx0J10gLSBTZWUgYGVkaXRvcmAgcHJvcGVydHkgb2Yge0BsaW5rIEZpbHRlclRyZWVPcHRpb25zT2JqZWN0fS5cbiAqXG4gKiBAcHJvcGVydHkgbWlzYyAtIE90aGVyIG1pc2NlbGxhbmVvdXMgcHJvcGVydGllcyB3aWxsIGJlIGNvcGllZCBkaXJlY3RseSB0byB0aGUgbmV3IGBGaXRsZXJOb2RlYCBvYmplY3QuIChUaGUgbmFtZSBcIm1pc2NcIiBoZXJlIGlzIGp1c3QgYSBzdGFuZC1pbjsgdGhlcmUgaXMgbm8gc3BlY2lmaWMgcHJvcGVydHkgY2FsbGVkIFwibWlzY1wiLilcbiAqXG4gKiAqIE1heSBkZXNjcmliZSBhIG5vbi10ZXJtaW5hbCBub2RlIHdpdGggcHJvcGVydGllczpcbiAqICAgKiBgc2NoZW1hYCAtIE92ZXJyaWRkZW4gb24gaW5zdGFudGlhdGlvbiBieSBgb3B0aW9ucy5zY2hlbWFgLiBJZiBib3RoIHVuc3BlY2lmaWVkLCB1c2VzIHBhcmVudCdzIGRlZmluaXRpb24uXG4gKiAgICogYG9wZXJhdG9yYCAtIE9uZSBvZiB7QGxpbmsgdHJlZU9wZXJhdG9yc30uXG4gKiAgICogYGNoaWxkcmVuYCAtICBBcnJheSBjb250YWluaW5nIGFkZGl0aW9uYWwgdGVybWluYWwgYW5kIG5vbi10ZXJtaW5hbCBub2Rlcy5cbiAqXG4gKiBUaGUgY29uc3RydWN0b3IgYXV0by1kZXRlY3RzIGBzdGF0ZWAncyB0eXBlOlxuICogICogSlNPTiBzdHJpbmcgdG8gYmUgcGFyc2VkIGJ5IGBKU09OLnBhcnNlKClgIGludG8gYSBwbGFpbiBvYmplY3RcbiAqICAqIFNRTCBXSEVSRSBjbGF1c2Ugc3RyaW5nIHRvIGJlIHBhcnNlZCBpbnRvIGEgcGxhaW4gb2JqZWN0XG4gKiAgKiBDU1Mgc2VsZWN0b3Igb2YgYW4gRWxlbWVudCB3aG9zZSBgdmFsdWVgIGNvbnRhaW5zIG9uZSBvZiB0aGUgYWJvdmVcbiAqICAqIHBsYWluIG9iamVjdFxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKlxuICogQHN1bW1hcnkgQSBub2RlIGluIGEgZmlsdGVyIHRyZWUuXG4gKlxuICogQGRlc2NyaXB0aW9uIEEgZmlsdGVyIHRyZWUgcmVwcmVzZW50cyBhIF9jb21wbGV4IGNvbmRpdGlvbmFsIGV4cHJlc3Npb25fIGFuZCBjb25zaXN0cyBvZiBhIHNpbmdsZSBpbnN0YW5jZSBvZiBhIHtAbGluayBGaWx0ZXJUcmVlfSBvYmplY3QgYXMgdGhlIF9yb290XyBvZiBhbiBfbl8tYXJ5IHRyZWUuXG4gKlxuICogRmlsdGVyIHRyZWVzIGFyZSBjb21wcmlzZWQgb2YgaW5zdGFuY2VzIG9mIGBGaWx0ZXJOb2RlYCBvYmplY3RzLiBIb3dldmVyLCB0aGUgYEZpbHRlck5vZGVgIGNvbnN0cnVjdG9yIGlzIGFuIFwiYWJzdHJhY3QgY2xhc3NcIjsgZmlsdGVyIG5vZGUgb2JqZWN0cyBhcmUgbmV2ZXIgaW5zdGFudGlhdGVkIGRpcmVjdGx5IGZyb20gdGhpcyBjb25zdHJ1Y3Rvci4gQSBmaWx0ZXIgdHJlZSBpcyBhY3R1YWxseSBjb21wcmlzZWQgb2YgaW5zdGFuY2VzIG9mIHR3byBcInN1YmNsYXNzZXNcIiBvZiBgRmlsdGVyTm9kZWAgb2JqZWN0czpcbiAqICoge0BsaW5rIEZpbHRlclRyZWV9IChvciBzdWJjbGFzcyB0aGVyZW9mKSBvYmplY3RzLCBpbnN0YW5jZXMgb2Ygd2hpY2ggcmVwcmVzZW50IHRoZSByb290IG5vZGUgYW5kIGFsbCB0aGUgYnJhbmNoIG5vZGVzOlxuICogICAqIFRoZXJlIGlzIGFsd2F5cyBleGFjdGx5IG9uZSByb290IG5vZGUsIGNvbnRhaW5pbmcgdGhlIHdob2xlIGZpbHRlciB0cmVlLCB3aGljaCByZXByZXNlbnRzIHRoZSBmaWx0ZXIgZXhwcmVzc2lvbiBpbiBpdHMgZW50aXJldHkuIFRoZSByb290IG5vZGUgaXMgZGlzdGluZ3Vpc2hlZCBieSBoYXZpbmcgbm8gcGFyZW50IG5vZGUuXG4gKiAgICogVGhlcmUgYXJlIHplcm8gb3IgbW9yZSBicmFuY2ggbm9kZXMsIG9yIHN1YnRyZWVzLCB3aGljaCBhcmUgY2hpbGQgbm9kZXMgb2YgdGhlIHJvb3Qgb3Igb3RoZXIgYnJhbmNoZXMgaGlnaGVyIHVwIGluIHRoZSB0cmVlLCByZXByZXNlbnRpbmcgc3ViZXhwcmVzc2lvbnMgd2l0aGluIHRoZSBsYXJnZXIgZmlsdGVyIGV4cHJlc3Npb24uIEVhY2ggYnJhbmNoIG5vZGUgaGFzIGV4YWN0bHkgb25lIHBhcmVudCBub2RlLlxuICogICAqIFRoZXNlIG5vZGVzIHBvaW50IHRvIHplcm8gb3IgbW9yZSBjaGlsZCBub2RlcyB3aGljaCBhcmUgZWl0aGVyIG5lc3RlZCBzdWJ0cmVlcywgb3I6XG4gKiAqIHtAbGluayBGaWx0ZXJMZWFmfSAob3Igc3ViY2xhc3MgdGhlcmVvZikgb2JqZWN0cywgZWFjaCBpbnN0YW5jZSBvZiB3aGljaCByZXByZXNlbnRzIGEgc2luZ2xlIHNpbXBsZSBjb25kaXRpb25hbCBleHByZXNzaW9uLiBUaGVzZSBhcmUgdGVybWluYWwgbm9kZXMsIGhhdmluZyBleGFjdGx5IG9uZSBwYXJlbnQgbm9kZSwgYW5kIG5vIGNoaWxkIG5vZGVzLlxuICpcbiAqIFRoZSBwcm9ncmFtbWVyIG1heSBleHRlbmQgdGhlIHNlbWFudGljcyBvZiBmaWx0ZXIgdHJlZXMgYnkgZXh0ZW5kaW5nIHRoZSBhYm92ZSBvYmplY3RzLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3FsSWRRdHNPYmplY3R9IFtzcWxJZFF0cz17YmVnOidcIicsZW5kOidcIid9XSAtIFF1b3RlIGNoYXJhY3RlcnMgZm9yIFNRTCBpZGVudGlmaWVycy4gVXNlZCBmb3IgYm90aCBwYXJzaW5nIGFuZCBnZW5lcmF0aW5nIFNRTC4gU2hvdWxkIGJlIHBsYWNlZCBvbiB0aGUgcm9vdCBub2RlLlxuICpcbiAqIEBwcm9wZXJ0eSB7SFRNTEVsZW1lbnR9IGVsIC0gVGhlIERPTSBlbGVtZW50IGNyZWF0ZWQgYnkgdGhlIGByZW5kZXJgIG1ldGhvZCB0byByZXByZXNlbnQgdGhpcyBub2RlLiBDb250YWlucyB0aGUgYGVsYHMgZm9yIGFsbCBjaGlsZCBub2RlcyAod2hpY2ggYXJlIHRoZW1zZWx2ZXMgcG9pbnRlZCB0byBieSB0aG9zZSBub2RlcykuIFRoaXMgaXMgYWx3YXlzIGdlbmVyYXRlZCBidXQgaXMgb25seSBpbiB0aGUgcGFnZSBET00gaWYgeW91IHB1dCBpdCB0aGVyZS5cbiAqL1xuXG52YXIgRmlsdGVyTm9kZSA9IEJhc2UuZXh0ZW5kKCdGaWx0ZXJOb2RlJywge1xuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ3JlYXRlIGEgbmV3IG5vZGUgb3Igc3VidHJlZS5cbiAgICAgKiBAZGVzYyBUeXBpY2FsbHkgdXNlZCBieSB0aGUgYXBwbGljYXRpb24gbGF5ZXIgdG8gY3JlYXRlIHRoZSBlbnRpcmUgZmlsdGVyIHRyZWU7IGFuZCBpbnRlcm5hbGx5LCByZWN1cnNpdmVseSwgdG8gY3JlYXRlIGVhY2ggbm9kZSBpbmNsdWRpbmcgYm90aCBzdWJ0cmVlcyBhbmQgbGVhdmVzLlxuICAgICAqXG4gICAgICogKipOb2RlIHByb3BlcnRpZXMgYW5kIG9wdGlvbnM6KiogTm9kZXMgYXJlIGluc3RhbnRpYXRlZCB3aXRoOlxuICAgICAqIDEuIENlcnRhaW4gKipyZXF1aXJlZCBwcm9wZXJ0aWVzKiogd2hpY2ggZGlmZmVyIGZvciBzdWJ0cmVlcyBhbmQgbGVhdmVzLlxuICAgICAqIDIuIEFyYml0cmFyeSAqKm5vbi1zdGFuZGFyZCBvcHRpb24gcHJvcGVydGllcyoqIGFyZSBkZWZpbmVkIG9uIHRoZSBgb3B0aW9uc2Agb2JqZWN0IChzbyBsb25nIGFzIHRoZWlyIG5hbWVzIGRvIG5vdCBjb25mbGljdCB3aXRoIGFueSBzdGFuZGFyZCBvcHRpb25zKSBhbmQgbmV2ZXIgcGVyc2lzdC5cbiAgICAgKiAzLiBDZXJ0YWluICoqc3RhbmRhcmQgb3B0aW9ucyBwcm9wZXJ0aWVzKiogYXMgZGVmaW5lZCBpbiB0aGUge0BsaW5rIEZpbHRlck5vZGV+b3B0aW9uc1NjaGVtYXxvcHRpb25zU2NoZW1hfSBoYXNoLCBjb21lIGZyb20gdmFyaW91cyBzb3VyY2VzLCBhcyBwcmlvcml0aXplZCBhcyBmb2xsb3dzOlxuICAgICAqICAgIDEuIGBvcHRpb25zYCBvYmplY3Q7IGRvZXMgbm90IHBlcnNpc3RcbiAgICAgKiAgICAyLiBgc3RhdGVgOyBvYmplY3Q7IHBlcnNpc3RzXG4gICAgICogICAgMy4gYHBhcmVudGAgb2JqZWN0OyBwZXJzaXN0c1xuICAgICAqICAgIDQuIGBkZWZhdWx0YCBvYmplY3Q7IGRvZXMgbm90IHBlcnNpc3RcbiAgICAgKlxuICAgICAqIE5vdGVzOlxuICAgICAqIDEuIFwiUGVyc2lzdHNcIiBtZWFucyBvdXRwdXQgYnkge0BsaW5rIEZpbHRlclRyZWUjZ2V0U3RhdGV8Z2V0U3RhdGUoKX0uXG4gICAgICogMi4gVGhlIGBwYXJlbnRgIG9iamVjdCBpcyBnZW5lcmF0ZWQgaW50ZXJuYWxseSBmb3Igc3VidHJlZXMuIEl0IGFsbG93cyBzdGFuZGFyZCBvcHRpb25zIHRvIGluaGVyaXQgZnJvbSB0aGUgcGFyZW50IG5vZGUuXG4gICAgICogMy4gVGhlIGBkZWZhdWx0YCBvYmplY3QgY29tZXMgZnJvbSB0aGUgYGRlZmF1bHRgIHByb3BlcnR5LCBpZiBhbnksIG9mIHRoZSB7QGxpbmsgRmlsdGVyTm9kZX5vcHRpb25zU2NoZW1hfHNjaGVtYSBvYmplY3R9IGZvciB0aGUgc3RhbmRhcmQgb3B0aW9uIGluIHF1ZXN0aW9uLiBOb3RlIHRoYXQgb25jZSBkZWZpbmVkLCBzdWJ0cmVlcyB3aWxsIHRoZW4gaW5oZXJpdCB0aGlzIHZhbHVlLlxuICAgICAqIDQuIElmIG5vdCBkZWZpbmVkIGJ5IGFueSBvZiB0aGUgYWJvdmUsIHRoZSBzdGFuZGFyZCBvcHRpb24gcmVtYWlucyB1bmRlZmluZWQgb24gdGhlIG5vZGUuXG4gICAgICpcbiAgICAgKiAqKlF1ZXJ5IEJ1aWxkZXIgVUkgc3VwcG9ydDoqKiBJZiB5b3VyIGFwcCB3YW50cyB0byBtYWtlIHVzZSBvZiB0aGUgZ2VuZXJhdGVkIFVJLCB5b3UgYXJlIHJlc3BvbnNpYmxlIGZvciBpbnNlcnRpbmcgdGhlIHRvcC1sZXZlbCBgLmVsYCBpbnRvIHRoZSBET00uIChPdGhlcndpc2UganVzdCBpZ25vcmUgaXQuKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlT3B0aW9uc09iamVjdH0gW29wdGlvbnNdIC0gVGhlIG5vZGUgc3RhdGU7IG9yIGFuIG9wdGlvbnMgb2JqZWN0IHBvc3NpYmx5IGNvbnRhaW5pbmcgYHN0YXRlYCBhbW9uZyBvdGhlciBvcHRpb25zLiBBbHRob3VnaCB5b3UgY2FuIGluc3RhbnRpYXRlIGEgZmlsdGVyIHdpdGhvdXQgYW55IG9wdGlvbnMsIHRoaXMgaXMgZ2VuZXJhbGx5IG5vdCB1c2VmdWwuIFNlZSAqSW5zdGFudGlhdGluZyBhIGZpbHRlciogaW4gdGhlIHtAbGluayBodHRwOi8vam9uZWl0LmdpdGh1Yi5pby9maWx0ZXItdHJlZS9pbmRleC5odG1sfHJlYWRtZX0gZm9yIGEgcHJhY3RpY2FsIGRpc2N1c3Npb24gb2YgbWluaW11bSBvcHRpb25zLlxuICAgICAqXG4gICAgICogKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICBpbml0aWFsaXplOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgIC8qKiBAc3VtbWFyeSBSZWZlcmVuY2UgdG8gdGhpcyBub2RlJ3MgcGFyZW50IG5vZGUuXG4gICAgICAgICAqIEBkZXNjIFdoZW4gdGhpcyBwcm9wZXJ0eSBpcyB1bmRlZmluZWQsIHRoaXMgbm9kZSBpcyB0aGUgcm9vdCBub2RlLlxuICAgICAgICAgKiBAdHlwZSB7RmlsdGVyTm9kZX1cbiAgICAgICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICAgICAqL1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCBvcHRpb25zLnBhcmVudCxcbiAgICAgICAgICAgIHJvb3QgPSBwYXJlbnQgJiYgcGFyZW50LnJvb3Q7XG5cbiAgICAgICAgaWYgKCFyb290KSB7XG4gICAgICAgICAgICByb290ID0gdGhpcztcblxuICAgICAgICAgICAgdGhpcy5zdHlsZXNoZWV0ID0gdGhpcy5zdHlsZXNoZWV0IHx8XG4gICAgICAgICAgICAgICAgY3NzSW5qZWN0b3Iob3B0aW9ucy5jc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudCk7XG5cbiAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxzID0gbmV3IENvbmRpdGlvbmFscyhvcHRpb25zKTsgLy8gLnNxbElkUXRzXG5cbiAgICAgICAgICAgIHRoaXMuUGFyc2VyU1FMID0gbmV3IFBhcnNlclNRTChvcHRpb25zKTsgLy8gLnNjaGVtYSwgLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lcywgLnJlc29sdmVBbGlhc2VzXG5cbiAgICAgICAgICAgIHZhciBrZXlzID0gWyduYW1lJ107XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5yZXNvbHZlQWxpYXNlcykge1xuICAgICAgICAgICAgICAgIGtleXMucHVzaCgnYWxpYXMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5maW5kT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBjYXNlU2Vuc2l0aXZlOiBvcHRpb25zLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lcyxcbiAgICAgICAgICAgICAgICBrZXlzOiBrZXlzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqIEBzdW1tYXJ5IENvbnZlbmllbmNlIHJlZmVyZW5jZSB0byB0aGUgcm9vdCBub2RlLlxuICAgICAgICAgKiBAbmFtZSByb290XG4gICAgICAgICAqIEB0eXBlIHtGaWx0ZXJOb2RlfVxuICAgICAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IHJvb3Q7XG5cbiAgICAgICAgdGhpcy5kb250UGVyc2lzdCA9IHt9OyAvLyBoYXNoIG9mIHRydXRoeSB2YWx1ZXNcblxuICAgICAgICB0aGlzLnNldFN0YXRlKG9wdGlvbnMuc3RhdGUsIG9wdGlvbnMpO1xuICAgIH0sXG5cbiAgICAvKiogSW5zZXJ0IGVhY2ggc3VidHJlZSBpbnRvIGl0cyBwYXJlbnQgbm9kZSBhbG9uZyB3aXRoIGEgXCJkZWxldGVcIiBidXR0b24uXG4gICAgICpcbiAgICAgKiBOT1RFOiBUaGUgcm9vdCB0cmVlICh3aGljaCBoYXMgbm8gcGFyZW50KSBtdXN0IGJlIGluc2VydGVkIGludG8gdGhlIERPTSBieSB0aGUgaW5zdGFudGlhdGluZyBjb2RlICh3aXRob3V0IGEgZGVsZXRlIGJ1dHRvbikuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICovXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMucGFyZW50KSB7XG4gICAgICAgICAgICB2YXIgbmV3TGlzdEl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KENISUxEX1RBRyk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm5vdGVzRWwpIHtcbiAgICAgICAgICAgICAgICBuZXdMaXN0SXRlbS5hcHBlbmRDaGlsZCh0aGlzLm5vdGVzRWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMua2VlcCkge1xuICAgICAgICAgICAgICAgIHZhciBlbCA9IHRoaXMudGVtcGxhdGVzLmdldCgncmVtb3ZlQnV0dG9uJyk7XG4gICAgICAgICAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnJlbW92ZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICBuZXdMaXN0SXRlbS5hcHBlbmRDaGlsZChlbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ld0xpc3RJdGVtLmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuXG4gICAgICAgICAgICB0aGlzLnBhcmVudC5lbC5xdWVyeVNlbGVjdG9yKENISUxEUkVOX1RBRykuYXBwZW5kQ2hpbGQobmV3TGlzdEl0ZW0pO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IHN0YXRlXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc11cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKi9cbiAgICBzZXRTdGF0ZTogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG9sZEVsID0gdGhpcy5lbDtcblxuICAgICAgICBzdGF0ZSA9IHRoaXMucGFyc2VTdGF0ZVN0cmluZyhzdGF0ZSwgb3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5taXhJblN0YW5kYXJkT3B0aW9ucyhzdGF0ZSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMubWl4SW5Ob25zdGFuZGFyZE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuY3JlYXRlVmlldyhzdGF0ZSk7XG4gICAgICAgIHRoaXMubG9hZFN0YXRlKHN0YXRlKTtcbiAgICAgICAgdGhpcy5yZW5kZXIoKTtcblxuICAgICAgICBpZiAob2xkRWwpIHtcbiAgICAgICAgICAgIHZhciBuZXdFbCA9IHRoaXMuZWw7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnQgJiYgb2xkRWwucGFyZW50RWxlbWVudC50YWdOYW1lID09PSAnTEknKSB7XG4gICAgICAgICAgICAgICAgb2xkRWwgPSBvbGRFbC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgICAgIG5ld0VsID0gbmV3RWwucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9sZEVsLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld0VsLCBvbGRFbCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ29udmVydCBhIHN0cmluZyB0byBhIHN0YXRlIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBkZXNjIFRoZXkgc3RyaW5nJ3Mgc3ludGF4IGlzIGluZmVycmVkIGFzIGZvbGxvd3M6XG4gICAgICogMS4gSWYgc3RhdGUgaXMgdW5kZWZpbmVkIG9yIGFscmVhZHkgYW4gb2JqZWN0LCByZXR1cm4gYXMgaXMuXG4gICAgICogMi4gSWYgYG9wdGlvbnMuY29udGV4dGAgaXMgZGVmaW5lZCwgYHN0YXRlYCBpcyBhc3N1bWVkIHRvIGJlIGEgQ1NTIHNlbGVjdG9yIHN0cmluZyAoYXV0by1kZXRlY3RlZCkgcG9pbnRpbmcgdG8gYW4gSFRNTCBmb3JtIGNvbnRyb2wgd2l0aCBhIGB2YWx1ZWAgcHJvcGVydHksIHN1Y2ggYXMgYSB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxJbnB1dEVsZW1lbnQgSFRNTElucHV0RWxlbWVudH0gb3IgYSB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0hUTUxUZXh0QXJlYUVsZW1lbnQgSFRNTFRleHRBcmVhRWxlbWVudH0uIFRoZSBlbGVtZW50IGlzIHNlbGVjdGVkIGFuZCBpZiBmb3VuZCwgaXRzIHZhbHVlIGlzIGZldGNoZWQgZnJvbSB0aGUgRE9NIGFuZCBhc3NpZ25lZCB0byBgc3RhdGVgLlxuICAgICAqIDMuIElmIGBvcHRpb25zLnN5bnRheGAgaXMgYCdhdXRvJ2AsIEpTT04gc3ludGF4IGlzIGRldGVjdGVkIGlmIGBzdGF0ZWAgYmVnaW5zIF9hbmRfIGVuZHMgd2l0aCBlaXRoZXIgYFtgIGFuZCBgXWAgX29yXyBge2AgYW5kIGB9YCAoaWdub3JpbmcgbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGUgc3BhY2UpLlxuICAgICAqIDQuIElmIEpTT04gc3ludGF4LCBwYXJzZSB0aGUgc3RyaW5nIGludG8gYW4gYWN0dWFsIGBGaWx0ZXJUcmVlU3RhdGVPYmplY3RgIHVzaW5nIHtAbGluayBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9HbG9iYWxfT2JqZWN0cy9KU09OL3BhcnNlfEpTT04ucGFyc2V9IGFuZCB0aHJvdyBhbiBlcnJvciBpZiB1bnBhcnNhYmxlLlxuICAgICAqIDUuIElmIG5vdCBKU09OLCBwYXJzZSB0aGUgc3RyaW5nIGFzIFNRTCBpbnRvIGFuIGFjdHVhbCBgRmlsdGVyVHJlZVN0YXRlT2JqZWN0YCB1c2luZyBwYXJzZXItU1FMJ3Mge0BsaW5rIFBhcnNlclNRTCNwYXJzZXJ8cGFyc2VyfSBhbmQgdGhyb3cgYW4gZXJyb3IgaWYgdW5wYXJzYWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyVHJlZVN0YXRlT2JqZWN0fSBbc3RhdGVdXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlU2V0U3RhdGVPcHRpb25zT2JqZWN0fSBbb3B0aW9uc11cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJUcmVlU3RhdGVPYmplY3R9IFRoZSB1bm1vbGVzdGVkIGBzdGF0ZWAgcGFyYW1ldGVyLiBUaHJvd3MgYW4gZXJyb3IgaWYgYHN0YXRlYCBpcyB1bmtub3duIG9yIGludmFsaWQgc3ludGF4LlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQGlubmVyXG4gICAgICovXG4gICAgcGFyc2VTdGF0ZVN0cmluZzogZnVuY3Rpb24oc3RhdGUsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhciBjb250ZXh0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIHN5bnRheCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5zeW50YXggfHwgJ2F1dG8nOyAvLyBkZWZhdWx0IGlzICdhdXRvJ1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSBjb250ZXh0LnF1ZXJ5U2VsZWN0b3Ioc3RhdGUpLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzeW50YXggPT09ICdhdXRvJykge1xuICAgICAgICAgICAgICAgICAgICBzeW50YXggPSByZUpTT04udGVzdChzdGF0ZSkgPyAnSlNPTicgOiAnU1FMJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHN5bnRheCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdKU09OJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSBKU09OLnBhcnNlKHN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignSlNPTiBwYXJzZXI6ICcgKyBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnU1FMJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLnJvb3QuUGFyc2VyU1FMLnBhcnNlKHN0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignU1FMIFdIRVJFIGNsYXVzZSBwYXJzZXI6ICcgKyBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEZpbHRlclRyZWVFcnJvcignVW5leHBlY3RlZCBpbnB1dCBzdGF0ZS4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGVhY2ggc3RhbmRhcmQgb3B0aW9uIGZyb20gd2hlbiBmb3VuZCBvbiB0aGUgYG9wdGlvbnNgIG9yIGBzdGF0ZWAgb2JqZWN0cywgcmVzcGVjdGl2ZWx5OyBvciBpZiBub3QgYW4gXCJvd25cIiBvcHRpb24sIG9uIHRoZSBgcGFyZW50YCBvYmplY3Qgb3IgZnJvbSB0aGUgb3B0aW9ucyBzY2hlbWEgZGVmYXVsdCAoaWYgYW55KVxuICAgICAqIEBwYXJhbSBzdGF0ZVxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICovXG4gICAgbWl4SW5TdGFuZGFyZE9wdGlvbnM6IGZ1bmN0aW9uKHN0YXRlLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBub2RlID0gdGhpcztcblxuICAgICAgICBfKEZpbHRlck5vZGUub3B0aW9uc1NjaGVtYSkuZWFjaChmdW5jdGlvbihvcHRpb25TY2hlbWEsIGtleSkge1xuICAgICAgICAgICAgaWYgKCFvcHRpb25TY2hlbWEuaWdub3JlICYmICh0aGlzICE9PSB0aGlzLnJvb3QgfHwgb3B0aW9uU2NoZW1hLnJvb3RCb3VuZCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3B0aW9uO1xuXG4gICAgICAgICAgICAgICAgbm9kZS5kb250UGVyc2lzdFtrZXldID0gLy8gdHJ1dGh5IGlmIGZyb20gYG9wdGlvbnNgIG9yIGBkZWZhdWx0YFxuICAgICAgICAgICAgICAgICAgICAob3B0aW9uID0gb3B0aW9ucyAmJiBvcHRpb25zW2tleV0pICE9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgICAgICAgKG9wdGlvbiA9IHN0YXRlICYmIHN0YXRlW2tleV0pID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICAgICAgIShvcHRpb25TY2hlbWEub3duIHx8IG5vZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBvcHRpb24gIT09IG51bGwpICYmXG4gICAgICAgICAgICAgICAgICAgICEob3B0aW9uID0gbm9kZS5wYXJlbnQgJiYgbm9kZS5wYXJlbnRba2V5XSkgJiZcbiAgICAgICAgICAgICAgICAgICAgKG9wdGlvbiA9IG9wdGlvblNjaGVtYS5kZWZhdWx0KTtcblxuICAgICAgICAgICAgICAgIGlmIChvcHRpb24gPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG5vZGVba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5kb250UGVyc2lzdFtrZXldID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleSA9PT0gJ3NjaGVtYScgJiYgIW9wdGlvbi53YWxrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhdHRhY2ggdGhlIGB3YWxrYCBhbmQgYGZpbmRgIGNvbnZlbmllbmNlIG1ldGhvZHMgdG8gdGhlIGBzY2hlbWFgIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb24ud2FsayA9IHBvcE1lbnUud2Fsay5iaW5kKG9wdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb24ubG9va3VwID0gcG9wTWVudS5sb29rdXAuYmluZChvcHRpb24sIG5vZGUucm9vdC5maW5kT3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbm9kZVtrZXldID0gb3B0aW9uO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBvcHRpb25zXG4gICAgICovXG4gICAgbWl4SW5Ob25zdGFuZGFyZE9wdGlvbnM6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzO1xuXG4gICAgICAgIC8vIGNvcHkgYWxsIHJlbWFpbmluZyBvcHRpb25zIGRpcmVjdGx5IHRvIHRoZSBuZXcgaW5zdGFuY2UsIG92ZXJyaWRpbmcgcHJvdG90eXBlIG1lbWJlcnMgb2YgdGhlIHNhbWUgbmFtZVxuICAgICAgICBfKG9wdGlvbnMpLmVhY2goZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICAgICAgaWYgKCFGaWx0ZXJOb2RlLm9wdGlvbnNTY2hlbWFba2V5XSkge1xuICAgICAgICAgICAgICAgIG5vZGVba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqIFJlbW92ZSBib3RoOlxuICAgICAqICogYHRoaXNgIGZpbHRlciBub2RlIGZyb20gaXQncyBgcGFyZW50YCdzIGBjaGlsZHJlbmAgY29sbGVjdGlvbjsgYW5kXG4gICAgICogKiBgdGhpc2AgZmlsdGVyIG5vZGUncyBgZWxgJ3MgY29udGFpbmVyIChhbHdheXMgYSBgPGxpPmAgZWxlbWVudCkgZnJvbSBpdHMgcGFyZW50IGVsZW1lbnQuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICovXG4gICAgcmVtb3ZlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGF2ZXJ0LFxuICAgICAgICAgICAgcGFyZW50ID0gdGhpcy5wYXJlbnQ7XG5cbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXIuY2FsbChwYXJlbnQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2RlbGV0ZScsXG4gICAgICAgICAgICAgICAgICAgIHByZXZlbnREZWZhdWx0OiBmdW5jdGlvbigpIHsgYXZlcnQgPSB0cnVlOyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWF2ZXJ0KSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQua2VlcCB8fCAvLyBuZXZlciBcInBydW5lXCIgKHJlbW92ZSBpZiBlbXB0eSkgdGhpcyBwYXJ0aWN1bGFyIHN1YmV4cHJlc3Npb25cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuLmxlbmd0aCA+IDEgLy8gdGhpcyBub2RlIGhhcyBzaWJsaW5ncyBzbyB3aWxsIG5vdCBiZSBlbXB0eSBhZnRlciB0aGlzIHJlbW92ZVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwcm9jZWVkIHdpdGggcmVtb3ZlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZWwucGFyZW50Tm9kZS5yZW1vdmUoKTsgLy8gdGhlIHBhcmVudCBpcyBhbHdheXMgdGhlIGNvbnRhaW5pbmcgPGxpPiB0YWdcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcmVuLnNwbGljZShwYXJlbnQuY2hpbGRyZW4uaW5kZXhPZih0aGlzKSwgMSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVjdXJzZSB0byBwcnVuZSBlbnRpcmUgc3ViZXhwcmVzc2lvbiBiZWNhdXNlIGl0J3MgcHJ1bmUtYWJsZSBhbmQgd291bGQgZW5kIHVwIGVtcHR5IChjaGlsZGxlc3MpXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV29yay1hcm91bmQgZm9yIGB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3IoJzpzY29wZT4nICsgc2VsZWN0b3IpYCBiZWNhdXNlIGA6c2NvcGVgIG5vdCBzdXBwb3J0ZWQgaW4gSUUxMS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKi9cbiAgICBmaXJzdENoaWxkT2ZUeXBlOiBmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICAgICB2YXIgZWwgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgICAgICBpZiAoZWwgJiYgZWwucGFyZW50RWxlbWVudCAhPT0gdGhpcy5lbCkge1xuICAgICAgICAgICAgZWwgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9LFxuXG4gICAgRXJyb3I6IEZpbHRlclRyZWVFcnJvcixcblxuICAgIHRlbXBsYXRlczogbmV3IFRlbXBsYXRlcygpXG59KTtcblxuLyoqIEB0eXBlZGVmIG9wdGlvbnNTY2hlbWFPYmplY3RcbiAqIEBzdW1tYXJ5IFN0YW5kYXJkIG9wdGlvbiBzY2hlbWFcbiAqIEBkZXNjIFN0YW5kYXJkIG9wdGlvbnMgYXJlIGF1dG9tYXRpY2FsbHkgYWRkZWQgdG8gbm9kZXMuIERhdGEgc291cmNlcyBmb3Igc3RhbmRhcmQgb3B0aW9ucyBpbmNsdWRlIGBvcHRpb25zYCwgYHN0YXRlYCwgYHBhcmVudGAgYW5kIGBkZWZhdWx0YCAoaW4gdGhhdCBvcmRlcikuIERlc2NyaWJlcyBzdGFuZGFyZCBvcHRpb25zIHRocm91Z2ggdmFyaW91cyBwcm9wZXJ0aWVzOlxuICogQHByb3BlcnR5IHtib29sZWFufSBbaWdub3JlXSAtIERvIG5vdCBhdXRvbWF0aWNhbGx5IGFkZCB0byBub2RlcyAocHJvY2Vzc2VkIGVsc2V3aGVyZSkuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtvd25dIC0gRG8gbm90IGF1dG9tYXRpY2FsbHkgYWRkIGZyb20gYHBhcmVudGAgb3IgYGRlZmF1bHRgLlxuICogQHByb3BlcnR5IHtib29sZWFufSBbcm9vdEJvdW5kXSAtIEF1dG9tYXRpY2FsbHkgYWRkIHRvIHJvb3Qgbm9kZSBvbmx5LlxuICogQHByb3BlcnR5IHsqfSBbZGVmYXVsdF0gLSBUaGlzIGlzIHRoZSBkZWZhdWx0IGRhdGEgc291cmNlIHdoZW4gYWxsIG90aGVyIHN0cmF0ZWdpZXMgZmFpbC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlZmluZXMgdGhlIHN0YW5kYXJkIG9wdGlvbnMgYXZhaWxhYmxlIHRvIGEgbm9kZS5cbiAqIEBkZXNjIFRoZSBmb2xsb3dpbmcgcHJvcGVydGllcyBiZWFyIHRoZSBzYW1lIG5hbWVzIGFzIHRoZSBub2RlIG9wdGlvbnMgdGhleSBkZWZpbmUuXG4gKiBAdHlwZSB7b2JqZWN0fVxuICogQG1lbWJlck9mIEZpbHRlck5vZGVcbiAqL1xuRmlsdGVyTm9kZS5vcHRpb25zU2NoZW1hID0ge1xuXG4gICAgc3RhdGU6IHsgaWdub3JlOiB0cnVlIH0sXG5cbiAgICBjc3NTdHlsZXNoZWV0UmVmZXJlbmNlRWxlbWVudDogeyBpZ25vcmU6IHRydWUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBEZWZhdWx0IGNvbHVtbiBzY2hlbWEgZm9yIGNvbHVtbiBkcm9wLWRvd25zIG9mIGRpcmVjdCBkZXNjZW5kYW50IGxlYWYgbm9kZXMgb25seS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7c3RyaW5nW119XG4gICAgICovXG4gICAgb3duU2NoZW1hOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IENvbHVtbiBzY2hlbWEgZm9yIGNvbHVtbiBkcm9wLWRvd25zIG9mIGFsbCBkZXNjZW5kYW50IG5vZGVzLiBQZXJ0YWlucyB0byBsZWFmIG5vZGVzIG9ubHkuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge21lbnVJdGVtW119XG4gICAgICovXG4gICAgc2NoZW1hOiB7fSxcblxuICAgIC8qKiBAc3VtbWFyeSBGaWx0ZXIgZWRpdG9yIGZvciB1c2VyIGludGVyZmFjZS5cbiAgICAgKiBAZGVzYyBOYW1lIG9mIGZpbHRlciBlZGl0b3IgdXNlZCBieSB0aGlzIGFuZCBhbGwgZGVzY2VuZGFudCBub2Rlcy4gUGVydGFpbnMgdG8gbGVhZiBub2RlcyBvbmx5LlxuICAgICAqIEBkZWZhdWx0ICdEZWZhdWx0J1xuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZWRpdG9yOiB7fSxcblxuICAgIC8qKiBAc3VtbWFyeSBFdmVudCBoYW5kbGVyIGZvciBVSSBldmVudHMuXG4gICAgICogQGRlc2MgU2VlICpFdmVudHMqIGluIHRoZSB7QGxpbmsgaHR0cDovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUvaW5kZXguaHRtbHxyZWFkbWV9IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJOb2RlI1xuICAgICAqIEB0eXBlIHtmdW5jdGlvbn1cbiAgICAgKi9cbiAgICBldmVudEhhbmRsZXI6IHt9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IEZpZWxkcyBkYXRhIHR5cGUuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICB0eXBlOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IFVuZGVsZXRlYWJsZSBub2RlLlxuICAgICAqIEBkZXNjIFRydXRoeSBtZWFucyBkb24ndCByZW5kZXIgYSBkZWxldGUgYnV0dG9uIG5leHQgdG8gdGhlIGZpbHRlciBlZGl0b3IgZm9yIHRoaXMgbm9kZS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBrZWVwOiB7IG93bjogdHJ1ZSB9LFxuXG4gICAgLyoqIEBzdW1tYXJ5IE92ZXJyaWRlIG9wZXJhdG9yIGxpc3QgYXQgYW55IG5vZGUuXG4gICAgICogQGRlc2MgVGhlIGRlZmF1bHQgaXMgYXBwbGllZCB0byB0aGUgcm9vdCBub2RlIGFuZCBhbnkgb3RoZXIgbm9kZSB3aXRob3V0IGFuIG9wZXJhdG9yIG1lbnUuXG4gICAgICogQGRlZmF1bHQge0BsaW5rIENvbmRpdGlvbmFscy5kZWZhdWx0T3BNZW51fS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7bWVudUl0ZW1bXX1cbiAgICAgKi9cbiAgICBvcE1lbnU6IHsgZGVmYXVsdDogQ29uZGl0aW9uYWxzLmRlZmF1bHRPcE1lbnUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBUcnV0aHkgY29uc2lkZXJzIG9wIHZhbGlkIG9ubHkgaWYgaW4gbWVudS5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBvcE11c3RCZUluTWVudToge30sXG5cbiAgICAvKiogQHN1bW1hcnkgRGljdGlvbmFyeSBvZiBvcGVyYXRvciBtZW51cyBmb3Igc3BlY2lmaWMgZGF0YSB0eXBlcy5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyTm9kZSNcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBkZXNjIEEgaGFzaCBvZiB0eXBlIG5hbWVzLiBFYWNoIG1lbWJlciB0aHVzIGRlZmluZWQgY29udGFpbnMgYSBzcGVjaWZpYyBvcGVyYXRvciBtZW51IGZvciBhbGwgZGVzY2VuZGFudCBsZWFmIG5vZGVzIHRoYXQ6XG4gICAgICogMS4gZG8gbm90IGhhdmUgdGhlaXIgb3duIG9wZXJhdG9yIG1lbnUgKGBvcE1lbnVgIHByb3BlcnR5KSBvZiB0aGVpciBvd247IGFuZFxuICAgICAqIDIuIHdob3NlIGNvbHVtbnMgcmVzb2x2ZSB0byB0aGF0IHR5cGUuXG4gICAgICpcbiAgICAgKiBUaGUgdHlwZSBpcyBkZXRlcm1pbmVkIGJ5IChpbiBwcmlvcml0eSBvcmRlcik6XG4gICAgICogMS4gdGhlIGB0eXBlYCBwcm9wZXJ0eSBvZiB0aGUge0BsaW5rIEZpbHRlckxlYWZ9OyBvclxuICAgICAqIDIuIHRoZSBgdHlwZWAgcHJvcGVydHkgb2YgdGhlIGVsZW1lbnQgaW4gdGhlIG5lYXJlc3Qgbm9kZSAoaW5jbHVkaW5nIHRoZSBsZWFmIG5vZGUgaXRzZWxmKSB0aGF0IGhhcyBhIGRlZmluZWQgYG93blNjaGVtYWAgb3IgYHNjaGVtYWAgYXJyYXkgcHJvcGVydHkgd2l0aCBhbiBlbGVtZW50IGhhdmluZyBhIG1hdGNoaW5nIGNvbHVtbiBuYW1lLlxuICAgICAqL1xuICAgIHR5cGVPcE1hcDogeyByb290Qm91bmQ6IHRydWUgfSxcblxuICAgIC8qKiBAc3VtbWFyeSBUcnV0aHkgd2lsbCBzb3J0IHRoZSBjb2x1bW4gbWVudXMuXG4gICAgICogQG1lbWJlck9mIEZpbHRlck5vZGUjXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc29ydENvbHVtbk1lbnU6IHt9XG59O1xuXG5GaWx0ZXJOb2RlLnNldFdhcm5pbmdDbGFzcyA9IGZ1bmN0aW9uKGVsLCB2YWx1ZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgICB2YWx1ZSA9IGVsLnZhbHVlO1xuICAgIH1cbiAgICBlbC5jbGFzc0xpc3RbdmFsdWUgPyAncmVtb3ZlJyA6ICdhZGQnXSgnZmlsdGVyLXRyZWUtd2FybmluZycpO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cbkZpbHRlck5vZGUuY2xpY2tJbiA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgaWYgKGVsKSB7XG4gICAgICAgIGlmIChlbC50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgZWwuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnbW91c2Vkb3duJykpOyB9LCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVsLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlck5vZGU7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuLy8gVGhpcyBpcyB0aGUgbWFpbiBmaWxlLCB1c2FibGUgYXMgaXMsIHN1Y2ggYXMgYnkgL3Rlc3QvaW5kZXguanMuXG5cbi8vIEZvciBucG06IHJlcXVpcmUgdGhpcyBmaWxlXG4vLyBGb3IgQ0ROOiBndWxwZmlsZS5qcyBicm93c2VyaWZpZXMgdGhpcyBmaWxlIHdpdGggc291cmNlbWFwIHRvIC9idWlsZC9maWx0ZXItdHJlZS5qcyBhbmQgdWdsaWZpZWQgd2l0aG91dCBzb3VyY2VtYXAgdG8gL2J1aWxkL2ZpbHRlci10cmVlLm1pbi5qcy4gVGhlIENETiBpcyBodHRwczovL2pvbmVpdC5naXRodWIuaW8vZmlsdGVyLXRyZWUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHBvcE1lbnUgPSByZXF1aXJlKCdwb3AtbWVudScpO1xudmFyIHVuc3RydW5naWZ5ID0gcmVxdWlyZSgndW5zdHJ1bmdpZnknKTtcblxudmFyIF8gPSByZXF1aXJlKCdvYmplY3QtaXRlcmF0b3JzJyk7XG52YXIgRmlsdGVyTm9kZSA9IHJlcXVpcmUoJy4vRmlsdGVyTm9kZScpO1xudmFyIEZpbHRlckxlYWYgPSByZXF1aXJlKCcuL0ZpbHRlckxlYWYnKTtcbnZhciBvcGVyYXRvcnMgPSByZXF1aXJlKCcuL3RyZWUtb3BlcmF0b3JzJyk7XG5cblxudmFyIG9yZGluYWwgPSAwO1xuXG4vKiogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBBbiBvYmplY3QgdGhhdCByZXByZXNlbnRzIHRoZSByb290IG5vZGUgb3IgYSBicmFuY2ggbm9kZSBpbiBhIGZpbHRlciB0cmVlLlxuICogQGRlc2MgQSBub2RlIHJlcHJlc2VudGluZyBhIHN1YmV4cHJlc3Npb24gaW4gdGhlIGZpbHRlciBleHByZXNzaW9uLiBNYXkgYmUgdGhvdWdodCBvZiBhcyBhIHBhcmVudGhlc2l6ZWQgc3ViZXhwcmVzc2lvbiBpbiBhbGdlYnJhaWMgZXhwcmVzc2lvbiBzeW50YXguIEFzIGRpc2N1c3NlZCB1bmRlciB7QGxpbmsgRmlsdGVyTm9kZX0sIGEgYEZpbHRlclRyZWVgIGluc3RhbmNlJ3MgY2hpbGQgbm9kZXMgbWF5IGJlIGVpdGhlcjpcbiAqICogT3RoZXIgKG5lc3RlZCkgYEZpbHRlclRyZWVgIChvciBzdWJjbGFzcyB0aGVyZW9mKSBub2RlcyByZXByZXNlbnRpbmcgc3ViZXhwcmVzc2lvbnMuXG4gKiAqIHtAbGluayBGaWx0ZXJMZWFmfSAob3Igc3ViY2xhc3MgdGhlcmVvZikgdGVybWluYWwgbm9kZXMgcmVwcmVzZW50aW5nIGNvbmRpdGlvbmFsIGV4cHJlc3Npb25zLlxuICpcbiAqIFRoZSBgRmlsdGVyVHJlZWAgb2JqZWN0IGFsc28gaGFzIG1ldGhvZHMsIHNvbWUgb2Ygd2hpY2ggb3BlcmF0ZSBvbiBhIHNwZWNpZmljIHN1YnRyZWUgaW5zdGFuY2UsIGFuZCBzb21lIG9mIHdoaWNoIHJlY3Vyc2UgdGhyb3VnaCBhbGwgdGhlIHN1YnRyZWUncyBjaGlsZCBub2RlcyBhbmQgYWxsIHRoZWlyIGRlc2NlbmRhbnRzLCBfZXRjLl9cbiAqXG4gKiBUaGUgcmVjdXJzaXZlIG1ldGhvZHMgYXJlIGludGVyZXN0aW5nLiBUaGV5IGFsbCB3b3JrIHNpbWlsYXJseSwgbG9vcGluZyB0aHJvdWdoIHRoZSBsaXN0IG9mIGNoaWxkIG5vZGVzLCByZWN1cnNpbmcgd2hlbiB0aGUgY2hpbGQgbm9kZSBpcyBhIG5lc3RlZCBzdWJ0cmVlICh3aGljaCB3aWxsIHJlY3Vyc2UgZnVydGhlciB3aGVuIGl0IGhhcyBpdHMgb3duIG5lc3RlZCBzdWJ0cmVlcyk7IGFuZCBjYWxsaW5nIHRoZSBwb2x5bW9ycGhpYyBtZXRob2Qgd2hlbiB0aGUgY2hpbGQgbm9kZSBpcyBhIGBGaWx0ZXJMZWFmYCBvYmplY3QsIHdoaWNoIGlzIGEgdGVybWluYWwgbm9kZS4gU3VjaCBwb2x5bW9ycGhpYyBtZXRob2RzIGluY2x1ZGUgYHNldFN0YXRlKClgLCBgZ2V0U3RhdGUoKWAsIGBpbnZhbGlkKClgLCBhbmQgYHRlc3QoKWAuXG4gKlxuICogRm9yIGV4YW1wbGUsIGNhbGxpbmcgYHRlc3QoZGF0YVJvdylgIG9uIHRoZSByb290IHRyZWUgcmVjdXJzZXMgdGhyb3VnaCBhbnkgc3VidHJlZXMgZXZlbnR1YWxseSBjYWxsaW5nIGB0ZXN0KGRhdGFSb3cpYCBvbiBlYWNoIG9mIGl0cyBsZWFmIG5vZGVzIGFuZCBjb25jYXRlbmF0aW5nIHRoZSByZXN1bHRzIHRvZ2V0aGVyIHVzaW5nIHRoZSBzdWJ0cmVlJ3MgYG9wZXJhdG9yYC4gVGhlIHN1YnRyZWUncyBgdGVzdChkYXRhUm93KWAgY2FsbCB0aGVuIHJldHVybnMgdGhlIHJlc3VsdCB0byBpdCdzIHBhcmVudCdzIGB0ZXN0KClgIGNhbGwsIF9ldGMuLF8gZXZlbnR1YWxseSBidWJibGluZyB1cCB0byB0aGUgcm9vdCBub2RlJ3MgYHRlc3QoZGF0YVJvdylgIGNhbGwsIHdoaWNoIHJldHVybnMgdGhlIGZpbmFsIHJlc3VsdCB0byB0aGUgb3JpZ2luYWwgY2FsbGVyLiBUaGlzIHJlc3VsdCBkZXRlcm1pbmVzIGlmIHRoZSBnaXZlbiBkYXRhIHJvdyBwYXNzZWQgdGhyb3VnaCB0aGUgZW50aXJlIGZpbHRlciBleHByZXNzaW9uIHN1Y2Nlc3NmdWxseSAoYHRydWVgKSBhbmQgc2hvdWxkIGJlIGRpc3BsYXllZCwgb3Igd2FzIGJsb2NrZWQgc29tZXdoZXJlIChgZmFsc2VgKSBhbmQgc2hvdWxkIG5vdCBiZSBkaXNwbGF5ZWQuXG4gKlxuICogTm90ZSB0aGF0IGluIHByYWN0aWNlOlxuICogMS4gYGNoaWxkcmVuYCBtYXkgYmUgZW1wdHkuIFRoaXMgcmVwcmVzZW50cyBhIGFuIGVtcHR5IHN1YmV4cHJlc3Npb24uIE5vcm1hbGx5IHBvaW50bGVzcywgZW1wdHkgc3ViZXhwcmVzc2lvbnMgY291bGQgYmUgcHJ1bmVkLiBGaWx0ZXItdHJlZSBhbGxvd3MgdGhlbSBob3dldmVyIGFzIGhhcm1sZXNzIHBsYWNlaG9sZGVycy5cbiAqIDEuIGBvcGVyYXRvcmAgbWF5IGJlIG9taXR0ZWQgaW4gd2hpY2ggY2FzZSBpdCBkZWZhdWx0cyB0byBBTkQuXG4gKiAxLiBBIGBmYWxzZWAgcmVzdWx0IGZyb20gYSBjaGlsZCBub2RlIHdpbGwgc2hvcnQtc3RvcCBhbiBBTkQgb3BlcmF0aW9uOyBhIGB0cnVlYCByZXN1bHQgd2lsbCBzaG9ydC1zdG9wIGFuIE9SIG9yIE5PUiBvcGVyYXRpb24uXG4gKlxuICogQWRkaXRpb25hbCBub3RlczpcbiAqIDEuIEEgYEZpbHRlclRyZWVgIG1heSBjb25zaXN0IG9mIGEgc2luZ2xlIGxlYWYsIGluIHdoaWNoIGNhc2UgdGhlIGNvbmNhdGVuYXRpb24gYG9wZXJhdG9yYCBpcyBub3QgbmVlZGVkIGFuZCBtYXkgYmUgbGVmdCB1bmRlZmluZWQuIEhvd2V2ZXIsIGlmIGEgc2Vjb25kIGNoaWxkIGlzIGFkZGVkIGFuZCB0aGUgb3BlcmF0b3IgaXMgc3RpbGwgdW5kZWZpbmVkLCBpdCB3aWxsIGJlIHNldCB0byB0aGUgZGVmYXVsdCAoYCdvcC1hbmQnYCkuXG4gKiAyLiBUaGUgb3JkZXIgb2YgdGhlIGNoaWxkcmVuIGlzIHVuZGVmaW5lZCBhcyBhbGwgb3BlcmF0b3JzIGFyZSBjb21tdXRhdGl2ZS4gRm9yIHRoZSAnYG9wLW9yYCcgb3BlcmF0b3IsIGV2YWx1YXRpb24gY2Vhc2VzIG9uIHRoZSBmaXJzdCBwb3NpdGl2ZSByZXN1bHQgYW5kIGZvciBlZmZpY2llbmN5LCBhbGwgc2ltcGxlIGNvbmRpdGlvbmFsIGV4cHJlc3Npb25zIHdpbGwgYmUgZXZhbHVhdGVkIGJlZm9yZSBhbnkgY29tcGxleCBzdWJleHByZXNzaW9ucy5cbiAqIDMuIEEgbmVzdGVkIGBGaWx0ZXJUcmVlYCBpcyBkaXN0aW5ndWlzaGVkIChkdWNrLXR5cGVkKSBmcm9tIGEgbGVhZiBub2RlIGJ5IHRoZSBwcmVzZW5jZSBvZiBhIGBjaGlsZHJlbmAgbWVtYmVyLlxuICogNC4gTmVzdGluZyBhIGBGaWx0ZXJUcmVlYCBjb250YWluaW5nIGEgc2luZ2xlIGNoaWxkIGlzIHZhbGlkIChhbGJlaXQgcG9pbnRsZXNzKS5cbiAqXG4gKiAqKlNlZSBhbHNvIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzdXBlcmNsYXNzOioqIHtAbGluayBGaWx0ZXJOb2RlfVxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbb3BlcmF0b3I9J29wLWFuZCddIC0gVGhlIG9wZXJhdG9yIHRoYXQgY29uY2F0ZW50YXRlcyB0aGUgdGVzdCByZXN1bHRzIGZyb20gYWxsIHRoZSBub2RlJ3MgYGNoaWxkcmVuYCAoY2hpbGQgbm9kZXMpLiBNdXN0IGJlIG9uZSBvZjpcbiAqICogYCdvcC1hbmQnYFxuICogKiBgJ29wLW9yJ2BcbiAqICogYCdvcC1ub3InYFxuICpcbiAqIE5vdGUgdGhhdCB0aGVyZSBpcyBvbmx5IG9uZSBgb3BlcmF0b3JgIHBlciBzdWJleHByZXNzaW9uLiBJZiB5b3UgbmVlZCB0byBtaXggb3BlcmF0b3JzLCBjcmVhdGUgYSBzdWJvcmRpbmF0ZSBzdWJleHByZXNzaW9uIGFzIG9uZSBvZiB0aGUgY2hpbGQgbm9kZXMuXG4gKlxuICogQHByb3BlcnR5IHtGaWx0ZXJOb2RlW119IGNoaWxkcmVuIC0gQSBsaXN0IG9mIGRlc2NlbmRhbnRzIG9mIHRoaXMgbm9kZS4gQXMgbm90ZWQsIHRoZXNlIG1heSBiZSBvdGhlciBgRmlsdGVyVHJlZWAgKG9yIHN1YmNsYXNzIHRoZXJlb2YpIG5vZGVzOyBvciBtYXkgYmUgdGVybWluYWwgYEZpbHRlckxlYWZgIChvciBzdWJjbGFzcyB0aGVyZW9mKSBub2Rlcy4gTWF5IGJlIGFueSBsZW5ndGggaW5jbHVkaW5nIDAgKG5vbmU7IGVtcHR5KS5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IFtrZWVwPWZhbHNlXSAtIERvIG5vdCBhdXRvbWF0aWNhbGx5IHBydW5lIHdoZW4gbGFzdCBjaGlsZCByZW1vdmVkLlxuICpcbiAqIEBwcm9wZXJ0eSB7ZmllbGRJdGVtW119IFtvd25TY2hlbWFdIC0gQ29sdW1uIG1lbnUgdG8gYmUgdXNlZCBvbmx5IGJ5IGxlYWYgbm9kZXMgdGhhdCBhcmUgY2hpbGRyZW4gKGRpcmVjdCBkZXNjZW5kYW50cykgb2YgdGhpcyBub2RlLlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZT0nc3VidHJlZSddIC0gVHlwZSBvZiBub2RlLCBmb3IgcmVuZGVyaW5nIHB1cnBvc2VzOyBuYW1lcyB0aGUgcmVuZGVyaW5nIHRlbXBsYXRlIHRvIHVzZSB0byBnZW5lcmF0ZSB0aGUgbm9kZSdzIFVJIHJlcHJlc2VudGF0aW9uLlxuICovXG52YXIgRmlsdGVyVHJlZSA9IEZpbHRlck5vZGUuZXh0ZW5kKCdGaWx0ZXJUcmVlJywge1xuXG4gICAgLyoqXG4gICAgICogSGFzaCBvZiBjb25zdHJ1Y3RvcnMgZm9yIG9iamVjdHMgdGhhdCBleHRlbmQgZnJvbSB7QGxpbmsgRmlsdGVyTGVhZn0sIHdoaWNoIGlzIHRoZSBgRGVmYXVsdGAgbWVtYmVyIGhlcmUuXG4gICAgICpcbiAgICAgKiBBZGQgYWRkaXRpb25hbCBlZGl0b3JzIHRvIHRoaXMgb2JqZWN0IChpbiB0aGUgcHJvdG90eXBlKSBwcmlvciB0byBpbnN0YW50aWF0aW5nIGEgbGVhZiBub2RlIHRoYXQgcmVmZXJzIHRvIGl0LiBUaGlzIG9iamVjdCBleGlzdHMgaW4gdGhlIHByb3RvdHlwZSBhbmQgYWRkaXRpb25zIHRvIGl0IHdpbGwgYWZmZWN0IGFsbCBub2RlcyB0aGF0IGRvbid0IGhhdmUgdGhlaXIgYW4gXCJvd25cIiBoYXNoLlxuICAgICAqXG4gICAgICogSWYgeW91IGNyZWF0ZSBhbiBcIm93blwiIGhhc2ggaW4geW91ciBpbnN0YW5jZSBiZSBzdXJlIHRvIGluY2x1ZGUgdGhlIGRlZmF1bHQgZWRpdG9yLCBmb3IgZXhhbXBsZTogYHsgRGVmYXVsdDogRmlsdGVyVHJlZS5wcm90b3R5cGUuZWRpdG9ycy5EZWZhdWx0LCAuLi4gfWAuIChPbmUgd2F5IG9mIG92ZXJyaWRpbmcgd291bGQgYmUgdG8gaW5jbHVkZSBzdWNoIGFuIG9iamVjdCBpbiBhbiBgZWRpdG9yc2AgbWVtYmVyIG9mIHRoZSBvcHRpb25zIG9iamVjdCBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yIG9uIGluc3RhbnRpYXRpb24uIFRoaXMgd29ya3MgYmVjYXVzZSBhbGwgbWlzY2VsbGFuZW91cyBtZW1iZXJzIGFyZSBzaW1wbHkgY29waWVkIHRvIHRoZSBuZXcgaW5zdGFuY2UuIE5vdCB0byBiZSBjb25mdXNlZCB3aXRoIHRoZSBzdGFuZGFyZCBvcHRpb24gYGVkaXRvcmAgd2hpY2ggaXMgYSBzdHJpbmcgY29udGFpbmluZyBhIGtleSBmcm9tIHRoaXMgaGFzaCBhbmQgdGVsbHMgdGhlIGxlYWYgbm9kZSB3aGF0IHR5cGUgdG8gdXNlLilcbiAgICAgKi9cbiAgICBlZGl0b3JzOiB7XG4gICAgICAgIERlZmF1bHQ6IEZpbHRlckxlYWZcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQW4gZXh0ZW5zaW9uIGlzIGEgaGFzaCBvZiBwcm90b3R5cGUgb3ZlcnJpZGVzIChtZXRob2RzLCBwcm9wZXJ0aWVzKSB1c2VkIHRvIGV4dGVuZCB0aGUgZGVmYXVsdCBlZGl0b3IuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtrZXk9J0RlZmF1bHQnXSAtIE5tZSBvZiB0aGUgbmV3IGV4dGVuc2lvbiBnaXZlbiBpbiBgZXh0YCBvciBuYW1lIG9mIGFuIGV4aXN0aW5nIGV4dGVuc2lvbiBpbiBgRmlsdGVyVHJlZS5leHRlbnNpb25zYC4gQXMgYSBjb25zdHJ1Y3Rvciwgc2hvdWxkIGhhdmUgYW4gaW5pdGlhbCBjYXBpdGFsLiBJZiBvbWl0dGVkLCByZXBsYWNlcyB0aGUgZGVmYXVsdCBlZGl0b3IgKEZpbHRlckxlYWYpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbZXh0XSBBbiBleHRlbnNpb24gaGFzaFxuICAgICAqIEBwYXJhbSB7RmlsZXJMZWFmfSBbQmFzZUVkaXRvcj10aGlzLmVkaXRvcnMuRGVmYXVsdF0gLSBDb25zdHJ1Y3RvciB0byBleHRlbmQgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7RmlsbHRlckxlYWZ9IEEgbmV3IGNsYXNzIGV4dGVuZGVkIGZyb20gYEJhc2VFZGl0b3JgIC0tIHdoaWNoIGlzIGluaXRpYWxseSBgRmlsdGVyTGVhZmAgYnV0IG1heSBpdHNlbGYgaGF2ZSBiZWVuIGV4dGVuZGVkIGJ5IGEgY2FsbCB0byBgLmFkZEVkaXRvcignRGVmYXVsdCcsIGV4dGVuc2lvbilgLlxuICAgICAqL1xuICAgIGFkZEVkaXRvcjogZnVuY3Rpb24oa2V5LCBleHQsIEJhc2VFZGl0b3IpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBga2V5YCAoc3RyaW5nKSB3YXMgb21pdHRlZFxuICAgICAgICAgICAgQmFzZUVkaXRvciA9IGV4dDtcbiAgICAgICAgICAgIGV4dCA9IGtleTtcbiAgICAgICAgICAgIGtleSA9ICdEZWZhdWx0JztcbiAgICAgICAgfVxuICAgICAgICBCYXNlRWRpdG9yID0gQmFzZUVkaXRvciB8fCB0aGlzLmVkaXRvcnMuRGVmYXVsdDtcbiAgICAgICAgZXh0ID0gZXh0IHx8IEZpbHRlclRyZWUuZXh0ZW5zaW9uc1trZXldO1xuICAgICAgICByZXR1cm4gKHRoaXMuZWRpdG9yc1trZXldID0gQmFzZUVkaXRvci5leHRlbmQoa2V5LCBleHQpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFRoZSBuYW1lIG9mIHRoZSBleGlzdGluZyBlZGl0b3IgdG8gcmVtb3ZlLlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIHJlbW92ZUVkaXRvcjogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdEZWZhdWx0Jykge1xuICAgICAgICAgICAgdGhyb3cgJ0Nhbm5vdCByZW1vdmUgZGVmYXVsdCBlZGl0b3IuJztcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgdGhpcy5lZGl0b3JzW2tleV07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgY3JlYXRlVmlldzogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZWwgPSB0aGlzLnRlbXBsYXRlcy5nZXQoXG4gICAgICAgICAgICB0aGlzLnR5cGUgfHwgJ3N1YnRyZWUnLFxuICAgICAgICAgICAgKytvcmRpbmFsLFxuICAgICAgICAgICAgdGhpcy5zY2hlbWFbMF0gJiYgcG9wTWVudS5mb3JtYXRJdGVtKHRoaXMuc2NoZW1hWzBdKVxuICAgICAgICApO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgZXhwcmVzc2lvbiBlZGl0b3JzIHRvIHRoZSBcImFkZCBuZXdcIiBkcm9wLWRvd25cbiAgICAgICAgdmFyIGFkZE5ld0N0cmwgPSB0aGlzLmZpcnN0Q2hpbGRPZlR5cGUoJ3NlbGVjdCcpO1xuICAgICAgICBpZiAoYWRkTmV3Q3RybCkge1xuICAgICAgICAgICAgdmFyIHN1Ym1lbnUsIG9wdGdyb3VwLFxuICAgICAgICAgICAgICAgIGVkaXRvcnMgPSB0aGlzLmVkaXRvcnM7XG5cbiAgICAgICAgICAgIGlmIChhZGROZXdDdHJsLmxlbmd0aCA9PT0gMSAmJiB0aGlzLmVkaXRvcnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gdGhpcyBlZGl0b3IgaXMgdGhlIG9ubHkgb3B0aW9uIGJlc2lkZXMgdGhlIG51bGwgcHJvbXB0IG9wdGlvblxuICAgICAgICAgICAgICAgIC8vIHNvIG1ha2UgaXQgdGggZW9ubHkgaXRlbSBpIHRoZSBkcm9wLWRvd25cbiAgICAgICAgICAgICAgICBzdWJtZW51ID0gYWRkTmV3Q3RybDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGFscmVhZHkgb3B0aW9ucyBhbmQvb3IgbXVsdGlwbGUgZWRpdG9yc1xuICAgICAgICAgICAgICAgIHN1Ym1lbnUgPSBvcHRncm91cCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGdyb3VwJyk7XG4gICAgICAgICAgICAgICAgb3B0Z3JvdXAubGFiZWwgPSAnQ29uZGl0aW9uYWwgRXhwcmVzc2lvbnMnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgT2JqZWN0LmtleXMoZWRpdG9ycykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IGVkaXRvcnNba2V5XS5wcm90b3R5cGUubmFtZSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgc3VibWVudS5hcHBlbmRDaGlsZChuZXcgT3B0aW9uKG5hbWUsIGtleSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAob3B0Z3JvdXApIHtcbiAgICAgICAgICAgICAgICBhZGROZXdDdHJsLmFkZChvcHRncm91cCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG9uY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uVHJlZU9wQ2xpY2suYmluZCh0aGlzKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgbG9hZFN0YXRlOiBmdW5jdGlvbihzdGF0ZSkge1xuICAgICAgICB0aGlzLm9wZXJhdG9yID0gJ29wLWFuZCc7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4gPSBbXTtcblxuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmFkZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVmFsaWRhdGUgYHN0YXRlLmNoaWxkcmVuYCAocmVxdWlyZWQpXG4gICAgICAgICAgICBpZiAoIShzdGF0ZS5jaGlsZHJlbiBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyB0aGlzLkVycm9yKCdFeHBlY3RlZCBgY2hpbGRyZW5gIHByb3BlcnR5IHRvIGJlIGFuIGFycmF5LicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBWYWxpZGF0ZSBgc3RhdGUub3BlcmF0b3JgIChpZiBnaXZlbilcbiAgICAgICAgICAgIGlmIChzdGF0ZS5vcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIGlmICghb3BlcmF0b3JzW3N0YXRlLm9wZXJhdG9yXSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgdGhpcy5FcnJvcignRXhwZWN0ZWQgYG9wZXJhdG9yYCBwcm9wZXJ0eSB0byBiZSBvbmUgb2Y6ICcgKyBPYmplY3Qua2V5cyhvcGVyYXRvcnMpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLm9wZXJhdG9yID0gc3RhdGUub3BlcmF0b3I7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN0YXRlLmNoaWxkcmVuLmZvckVhY2godGhpcy5hZGQuYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmFkaW9CdXR0b24gPSB0aGlzLmZpcnN0Q2hpbGRPZlR5cGUoJ2xhYmVsID4gaW5wdXRbdmFsdWU9JyArIHRoaXMub3BlcmF0b3IgKyAnXScpLFxuICAgICAgICAgICAgYWRkRmlsdGVyTGluayA9IHRoaXMuZWwucXVlcnlTZWxlY3RvcignLmZpbHRlci10cmVlLWFkZC1jb25kaXRpb25hbCcpO1xuXG4gICAgICAgIGlmIChyYWRpb0J1dHRvbikge1xuICAgICAgICAgICAgcmFkaW9CdXR0b24uY2hlY2tlZCA9IHRydWU7XG4gICAgICAgICAgICBvblRyZWVPcENsaWNrLmNhbGwodGhpcywge1xuICAgICAgICAgICAgICAgIHRhcmdldDogcmFkaW9CdXR0b25cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2hlbiBtdWx0aXBsZSBmaWx0ZXIgZWRpdG9ycyBhdmFpbGFibGUsIHNpbXVsYXRlIGNsaWNrIG9uIHRoZSBuZXcgXCJhZGQgY29uZGl0aW9uYWxcIiBsaW5rXG4gICAgICAgIGlmIChhZGRGaWx0ZXJMaW5rICYmICF0aGlzLmNoaWxkcmVuLmxlbmd0aCAmJiBPYmplY3Qua2V5cyh0aGlzLmVkaXRvcnMpLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHRoaXNbJ2ZpbHRlci10cmVlLWFkZC1jb25kaXRpb25hbCddKHtcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGFkZEZpbHRlckxpbmtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvY2VlZCB3aXRoIHJlbmRlclxuICAgICAgICBGaWx0ZXJOb2RlLnByb3RvdHlwZS5yZW5kZXIuY2FsbCh0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHN1bW1hcnkgQ3JlYXRlIGEgbmV3IG5vZGUgYXMgcGVyIGBzdGF0ZWAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnM9e3N0YXRlOnt9fV0gLSBNYXkgYmUgb25lIG9mOlxuICAgICAqXG4gICAgICogKiBhbiBgb3B0aW9uc2Agb2JqZWN0IGNvbnRhaW5pbmcgYSBgc3RhdGVgIHByb3BlcnR5XG4gICAgICogKiBhIGBzdGF0ZWAgb2JqZWN0IChpbiB3aGljaCBjYXNlIHRoZXJlIGlzIG5vIGBvcHRpb25zYCBvYmplY3QpXG4gICAgICpcbiAgICAgKiBJbiBhbnkgY2FzZSwgcmVzdWx0aW5nIGBzdGF0ZWAgb2JqZWN0IG1heSBiZSBlaXRoZXIuLi5cbiAgICAgKiAqIEEgbmV3IHN1YnRyZWUgKGhhcyBhIGBjaGlsZHJlbmAgcHJvcGVydHkpOlxuICAgICAqICAgQWRkIGEgbmV3IGBGaWx0ZXJUcmVlYCBub2RlLlxuICAgICAqICogQSBuZXcgbGVhZiAobm8gYGNoaWxkcmVuYCBwcm9wZXJ0eSk6IGFkZCBhIG5ldyBgRmlsdGVyTGVhZmAgbm9kZTpcbiAgICAgKiAgICogSWYgdGhlcmUgaXMgYW4gYGVkaXRvcmAgcHJvcGVydHk6XG4gICAgICogICAgIEFkZCBsZWFmIHVzaW5nIGB0aGlzLmVkaXRvcnNbc3RhdGUuZWRpdG9yXWAuXG4gICAgICogICAqIE90aGVyd2lzZSAoaW5jbHVkaW5nIHRoZSBjYXNlIHdoZXJlIGBzdGF0ZWAgaXMgdW5kZWZpbmVkKTpcbiAgICAgKiAgICAgQWRkIGxlYWYgdXNpbmcgYHRoaXMuZWRpdG9ycy5EZWZhdWx0YC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZm9jdXM9ZmFsc2VdIENhbGwgaW52YWxpZCgpIGFmdGVyIGluc2VydGluZyB0byBmb2N1cyBvbiBmaXJzdCBibGFuayBjb250cm9sIChpZiBhbnkpLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlck5vZGV9IFRoZSBuZXcgbm9kZS5cbiAgICAgKlxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJUcmVlI1xuICAgICAqL1xuICAgIGFkZDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgQ29uc3RydWN0b3IsIG5ld05vZGU7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnN0YXRlKSB7XG4gICAgICAgICAgICBvcHRpb25zID0geyBzdGF0ZTogb3B0aW9ucyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3RhdGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIENvbnN0cnVjdG9yID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIENvbnN0cnVjdG9yID0gdGhpcy5lZGl0b3JzW29wdGlvbnMuc3RhdGUuZWRpdG9yIHx8ICdEZWZhdWx0J107XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zLnBhcmVudCA9IHRoaXM7XG4gICAgICAgIG5ld05vZGUgPSBuZXcgQ29uc3RydWN0b3Iob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChuZXdOb2RlKTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mb2N1cykge1xuICAgICAgICAgICAgLy8gZm9jdXMgb24gYmxhbmsgY29udHJvbCBhIGJlYXQgYWZ0ZXIgYWRkaW5nIGl0XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBuZXdOb2RlLmludmFsaWQob3B0aW9ucyk7IH0sIDc1MCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcbiAgICB9LFxuXG4gICAgLyoqIEB0eXBlZGVmIHtvYmplY3R9IEZpbHRlclRyZWVWYWxpZGF0aW9uT3B0aW9uc09iamVjdFxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW3Rocm93PWZhbHNlXSAtIFRocm93IChkbyBub3QgY2F0Y2gpIGBGaWx0ZXJUcmVlRXJyb3Jgcy5cbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IFthbGVydD1mYWxzZV0gLSBBbm5vdW5jZSBlcnJvciB2aWEgd2luZG93LmFsZXJ0KCkgYmVmb3JlIHJldHVybmluZy5cbiAgICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IFtmb2N1cz1mYWxzZV0gLSBQbGFjZSB0aGUgZm9jdXMgb24gdGhlIG9mZmVuZGluZyBjb250cm9sIGFuZCBnaXZlIGl0IGVycm9yIGNvbG9yLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJUcmVlVmFsaWRhdGlvbk9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR8RmlsdGVyVHJlZUVycm9yfSBgdW5kZWZpbmVkYCBpZiB2YWxpZDsgb3IgdGhlIGNhdWdodCBgRmlsdGVyVHJlZUVycm9yYCBpZiBlcnJvci5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBpbnZhbGlkOiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICAgIHZhciByZXN1bHQsIHRocm93V2FzO1xuXG4gICAgICAgIHRocm93V2FzID0gb3B0aW9ucy50aHJvdztcbiAgICAgICAgb3B0aW9ucy50aHJvdyA9IHRydWU7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGludmFsaWQuY2FsbCh0aGlzLCBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBlcnI7XG5cbiAgICAgICAgICAgIC8vIFRocm93IHdoZW4gdW5leHBlY3RlZCAobm90IGEgZmlsdGVyIHRyZWUgZXJyb3IpXG4gICAgICAgICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiB0aGlzLkVycm9yKSkge1xuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG9wdGlvbnMudGhyb3cgPSB0aHJvd1dhcztcblxuICAgICAgICAvLyBBbHRlciBhbmQvb3IgdGhyb3cgd2hlbiByZXF1ZXN0ZWRcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWxlcnQpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cuYWxlcnQocmVzdWx0Lm1lc3NhZ2UgfHwgcmVzdWx0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudGhyb3cpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhUm93XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICogQG1lbWJlck9mIEZpbHRlclRyZWUjXG4gICAgICovXG4gICAgdGVzdDogZnVuY3Rpb24gdGVzdChkYXRhUm93KSB7XG4gICAgICAgIHZhciBvcGVyYXRvciA9IG9wZXJhdG9yc1t0aGlzLm9wZXJhdG9yXSxcbiAgICAgICAgICAgIHJlc3VsdCA9IG9wZXJhdG9yLnNlZWQsXG4gICAgICAgICAgICBub0NoaWxkcmVuRGVmaW5lZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5maW5kKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICBub0NoaWxkcmVuRGVmaW5lZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEZpbHRlckxlYWYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gb3BlcmF0b3IucmVkdWNlKHJlc3VsdCwgY2hpbGQudGVzdChkYXRhUm93KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gb3BlcmF0b3IucmVkdWNlKHJlc3VsdCwgdGVzdC5jYWxsKGNoaWxkLCBkYXRhUm93KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQgPT09IG9wZXJhdG9yLmFib3J0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBub0NoaWxkcmVuRGVmaW5lZCB8fCAob3BlcmF0b3IubmVnYXRlID8gIXJlc3VsdCA6IHJlc3VsdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IE51bWJlciBvZiBmaWx0ZXJzICh0ZXJtaW5hbCBub2RlcykgZGVmaW5lZCBpbiB0aGlzIHN1YnRyZWUuXG4gICAgICovXG4gICAgZmlsdGVyQ291bnQ6IGZ1bmN0aW9uIGZpbHRlckNvdW50KCkge1xuICAgICAgICB2YXIgbiA9IDA7XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBuICs9IGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZiA/IDEgOiBmaWx0ZXJDb3VudC5jYWxsKGNoaWxkKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIG47XG4gICAgfSxcblxuICAgIC8qKiBAdHlwZWRlZiB7b2JqZWN0fSBGaWx0ZXJUcmVlR2V0U3RhdGVPcHRpb25zT2JqZWN0XG4gICAgICpcbiAgICAgKiBAc3VtbWFyeSBPYmplY3QgY29udGFpbmluZyBvcHRpb25zIGZvciBwcm9kdWNpbmcgYSBzdGF0ZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAZGVzYyBTdGF0ZSBpcyBjb21tb25seSB1c2VkIGZvciB0d28gcHVycG9zZXM6XG4gICAgICogMS4gVG8gcGVyc2lzdCB0aGUgZmlsdGVyIHN0YXRlIHNvIHRoYXQgaXQgY2FuIGJlIHJlbG9hZGVkIGxhdGVyLlxuICAgICAqIDIuIFRvIHNlbmQgYSBxdWVyeSB0byBhIGRhdGFiYXNlIGVuZ2luZS5cbiAgICAgKlxuICAgICAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gW3N5bnRheD0nb2JqZWN0J10gLSBBIGNhc2Utc2Vuc2l0aXZlIHN0cmluZyBpbmRpY2F0aW5nIHRoZSBleHBlY3RlZCB0eXBlIGFuZCBmb3JtYXQgb2YgYSBzdGF0ZSBvYmplY3QgdG8gYmUgZ2VuZXJhdGVkIGZyb20gYSBmaWx0ZXIgdHJlZS4gT25lIG9mOlxuICAgICAqICogYCdvYmplY3QnYCAoZGVmYXVsdCkgQSByYXcgc3RhdGUgb2JqZWN0IHByb2R1Y2VkIGJ5IHdhbGtpbmcgdGhlIHRyZWUgdXNpbmcgYHtAbGluayBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS91bnN0cnVuZ2lmeXx1bnN0cnVuZ2lmeSgpfWAsIHJlc3BlY3RpbmcgYEpTT04uc3RyaW5naWZ5KClgJ3MgXCJ7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSlNPTi9zdHJpbmdpZnkjdG9KU09OKClfYmVoYXZpb3J8dG9KU09OKCkgYmVoYXZpb3J9LFwiIGFuZCByZXR1cm5pbmcgYSBwbGFpbiBvYmplY3Qgc3VpdGFibGUgZm9yIHJlc3VibWl0dGluZyB0byB7QGxpbmsgRmlsdGVyTm9kZSNzZXRTdGF0ZXxzZXRTdGF0ZX0uIFRoaXMgaXMgYW4gXCJlc3NlbnRpYWxcIiB2ZXJzaW9uIG9mIHRoZSBhY3R1YWwgbm9kZSBvYmplY3RzIGluIHRoZSB0cmVlLlxuICAgICAqICogYCdKU09OJ2AgLSBBIHN0cmluZ2lmaWVkIHN0YXRlIG9iamVjdCBwcm9kdWNlZCBieSB3YWxraW5nIHRoZSB0cmVlIHVzaW5nIGB7QGxpbmsgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvSlNPTi9zdHJpbmdpZnkjdG9KU09OKClfYmVoYXZpb3J8SlNPTi5zdHJpbmdpZnkoKX1gLCByZXR1cm5pbmcgYSBKU09OIHN0cmluZyBieSBjYWxsaW5nIGB0b0pTT05gIGF0IGV2ZXJ5IG5vZGUuIFRoaXMgaXMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIHNhbWUgXCJlc3NlbnRpYWxcIiBvYmplY3QgYXMgdGhhdCBwcm9kdWNlZCBieSB0aGUgYCdvYmplY3QnYCBvcHRpb24sIGJ1dCBcInN0cmluZ2lmaWVkXCIgYW5kIHRoZXJlZm9yZSBzdWl0YWJsZSBmb3IgdGV4dC1iYXNlZCBzdG9yYWdlIG1lZGlhLlxuICAgICAqICogYCdTUUwnYCAtIFRoZSBzdWJleHByZXNzaW9uIGluIFNRTCBjb25kaXRpb25hbCBzeW50YXggcHJvZHVjZWQgYnkgd2Fsa2luZyB0aGUgdHJlZSBhbmQgcmV0dXJuaW5nIGEgU1FMIFtzZWFyY2ggY29uZGl0aW9uIGV4cHJlc3Npb25de0BsaW5rIGh0dHBzOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXMxNzM1NDUuYXNweH0uIFN1aXRhYmxlIGZvciB1c2UgaW4gdGhlIFdIRVJFIGNsYXVzZSBvZiBhIFNRTCBgU0VMRUNUYCBzdGF0ZW1lbnQgdXNlZCB0byBxdWVyeSBhIGRhdGFiYXNlIGZvciBhIGZpbHRlcmVkIHJlc3VsdCBzZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IFtzcGFjZV0gLSBXaGVuIGBvcHRpb25zLnN5bnRheCA9PT0gJ0pTT04nYCwgZm9yd2FyZGVkIHRvIGBKU09OLnN0cmluZ2lmeWAgYXMgdGhlIHRoaXJkIHBhcmFtZXRlciwgYHNwYWNlYCAoc2VlKS5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoZSBTUUwgc3ludGF4IHJlc3VsdCBjYW5ub3QgYWNjb21tb2RhdGUgbm9kZSBtZXRhLWRhdGEuIFdoaWxlIG1ldGEtZGF0YSBzdWNoIGFzIGB0eXBlYCB0eXBpY2FsbHkgY29tZXMgZnJvbSB0aGUgY29sdW1uIHNjaGVtYSwgbWV0YS1kYXRhIGNhbiBiZSBpbnN0YWxsZWQgZGlyZWN0bHkgb24gYSBub2RlLiBTdWNoIG1ldGEtZGF0YSB3aWxsIG5vdCBiZSBwYXJ0IG9mIHRoZSByZXN1bHRpbmcgU1FMIGV4cHJlc3Npb24uIEZvciB0aGlzIHJlYXNvbiwgU1FMIHNob3VsZCBub3QgYmUgdXNlZCB0byBwZXJzaXN0IGZpbHRlciBzdGF0ZSBidXQgcmF0aGVyIGl0cyB1c2Ugc2hvdWxkIGJlIGxpbWl0ZWQgdG8gZ2VuZXJhdGluZyBhIGZpbHRlciBxdWVyeSBmb3IgYSByZW1vdGUgZGF0YSBzZXJ2ZXIuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBHZXQgYSByZXByZXNlbnRhdGlvbiBvZiBmaWx0ZXIgc3RhdGUuXG4gICAgICogQGRlc2MgQ2FsbGluZyB0aGlzIG9uIHRoZSByb290IHdpbGwgZ2V0IHRoZSBlbnRpcmUgdHJlZSdzIHN0YXRlOyBjYWxsaW5nIHRoaXMgb24gYW55IHN1YnRyZWUgd2lsbCBnZXQganVzdCB0aGF0IHN1YnRyZWUncyBzdGF0ZS5cbiAgICAgKlxuICAgICAqIE9ubHkgX2Vzc2VudGlhbF8gcHJvcGVydGllcyB3aWxsIGJlIG91dHB1dDpcbiAgICAgKlxuICAgICAqIDEuIGBGaWx0ZXJUcmVlYCBub2RlcyB3aWxsIG91dHB1dCBhdCBsZWFzdCAyIHByb3BlcnRpZXM6XG4gICAgICogICAgKiBgb3BlcmF0b3JgXG4gICAgICogICAgKiBgY2hpbGRyZW5gXG4gICAgICogMi4gYEZpbHRlckxlYWZgIG5vZGVzIHdpbGwgb3V0cHV0ICh2aWEge0BsaW5rIEZpbHRlckxlYWYjZ2V0U3RhdGV8Z2V0U3RhdGV9KSBhdCBsZWFzdCAzIHByb3BlcnRpZXMsIG9uZSBwcm9wZXJ0eSBmb3IgZWFjaCBpdGVtIGluIGl0J3MgYHZpZXdgOlxuICAgICAqICAgICogYGNvbHVtbmBcbiAgICAgKiAgICAqIGBvcGVyYXRvcmBcbiAgICAgKiAgICAqIGBvcGVyYW5kYFxuICAgICAqIDMuIEFkZGl0aW9uYWwgbm9kZSBwcm9wZXJ0aWVzIHdpbGwgYmUgb3V0cHV0IHdoZW46XG4gICAgICogICAgMS4gV2hlbiB0aGUgcHJvcGVydHkgd2FzICoqTk9UKiogZXh0ZXJuYWxseSBzb3VyY2VkOlxuICAgICAqICAgICAgIDEuIERpZCAqbm90KiBjb21lIGZyb20gdGhlIGBvcHRpb25zYCBvYmplY3Qgb24gbm9kZSBpbnN0YW50aWF0aW9uLlxuICAgICAqICAgICAgIDIuIERpZCAqbm90KiBjb21lIGZyb20gdGhlIG9wdGlvbnMgc2NoZW1hIGBkZWZhdWx0YCBvYmplY3QsIGlmIGFueS5cbiAgICAgKiAgICAyLiAqKkFORCoqIGF0IGxlYXN0IG9uZSBvZiB0aGUgZm9sbG93aW5nIGlzIHRydWU6XG4gICAgICogICAgICAgMS4gV2hlbiBpdCdzIGFuIFwib3duXCIgcHJvcGVydHkuXG4gICAgICogICAgICAgMi4gV2hlbiBpdHMgdmFsdWUgZGlmZmVycyBmcm9tIGl0J3MgcGFyZW50J3MuXG4gICAgICogICAgICAgMy4gV2hlbiB0aGlzIGlzIHRoZSByb290IG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0ZpbHRlclRyZWVHZXRTdGF0ZU9wdGlvbnNPYmplY3R9IFtvcHRpb25zXVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5zcWxJZFF0c10gLSBXaGVuIGBvcHRpb25zLnN5bnRheCA9PT0gJ1NRTCdgLCBmb3J3YXJkZWQgdG8gYGNvbmRpdGlvbmFscy5wdXNoU3FsSWRRdHMoKWAuXG4gICAgICogQHJldHVybnMge29iamVjdHxzdHJpbmd9IFJldHVybnMgb2JqZWN0IHdoZW4gYG9wdGlvbnMuc3ludGF4ID09PSAnb2JqZWN0J2A7IG90aGVyd2lzZSByZXR1cm5zIHN0cmluZy5cbiAgICAgKiBAbWVtYmVyT2YgRmlsdGVyVHJlZSNcbiAgICAgKi9cbiAgICBnZXRTdGF0ZTogZnVuY3Rpb24gZ2V0U3RhdGUob3B0aW9ucykge1xuICAgICAgICB2YXIgcmVzdWx0ID0gJycsXG4gICAgICAgICAgICBzeW50YXggPSBvcHRpb25zICYmIG9wdGlvbnMuc3ludGF4IHx8ICdvYmplY3QnO1xuXG4gICAgICAgIHN3aXRjaCAoc3ludGF4KSB7XG4gICAgICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHVuc3RydW5naWZ5LmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ0pTT04nOlxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHRoaXMsIG51bGwsIG9wdGlvbnMgJiYgb3B0aW9ucy5zcGFjZSkgfHwgJyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ1NRTCc6XG4gICAgICAgICAgICAgICAgdmFyIGxleGVtZSA9IG9wZXJhdG9yc1t0aGlzLm9wZXJhdG9yXS5TUUw7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQsIGlkeCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3AgPSBpZHggPyAnICcgKyBsZXhlbWUub3AgKyAnICcgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IG9wICsgY2hpbGQuZ2V0U3RhdGUob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gb3AgKyBnZXRTdGF0ZS5jYWxsKGNoaWxkLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBsZXhlbWUuYmVnICsgcmVzdWx0ICsgbGV4ZW1lLmVuZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IHRoaXMuRXJyb3IoJ1Vua25vd24gc3ludGF4IG9wdGlvbiBcIicgKyBzeW50YXggKyAnXCInKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIHRvSlNPTjogZnVuY3Rpb24gdG9KU09OKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICAgICBzdGF0ZSA9IHtcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogdGhpcy5vcGVyYXRvcixcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5jaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICBzdGF0ZS5jaGlsZHJlbi5wdXNoKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZiA/IGNoaWxkIDogdG9KU09OLmNhbGwoY2hpbGQpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXyhGaWx0ZXJOb2RlLm9wdGlvbnNTY2hlbWEpLmVhY2goZnVuY3Rpb24ob3B0aW9uU2NoZW1hLCBrZXkpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBzZWxmW2tleV0gJiYgLy8gdGhlcmUgaXMgYSBzdGFuZGFyZCBvcHRpb24gb24gdGhlIG5vZGUgd2hpY2ggbWF5IG5lZWQgdG8gYmUgb3V0cHV0XG4gICAgICAgICAgICAgICAgIXNlbGYuZG9udFBlcnNpc3Rba2V5XSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvblNjaGVtYS5vd24gfHwgLy8gb3V0cHV0IGJlY2F1c2UgaXQncyBhbiBcIm93blwiIG9wdGlvbiAoYmVsb25ncyB0byB0aGUgbm9kZSlcbiAgICAgICAgICAgICAgICAgICAgIXNlbGYucGFyZW50IHx8IC8vIG91dHB1dCBiZWNhdXNlIGl0J3MgdGhlIHJvb3Qgbm9kZVxuICAgICAgICAgICAgICAgICAgICBzZWxmW2tleV0gIT09IHNlbGYucGFyZW50W2tleV0gLy8gb3V0cHV0IGJlY2F1c2UgaXQgZGlmZmVycyBmcm9tIGl0cyBwYXJlbnQncyB2ZXJzaW9uXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgc3RhdGVba2V5XSA9IHNlbGZba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc3VtbWFyeSBTZXQgdGhlIGNhc2Ugc2Vuc2l0aXZpdHkgb2YgZmlsdGVyIHRlc3RzIGFnYWluc3QgZGF0YS5cbiAgICAgKiBAZGVzYyBDYXNlIHNlbnNpdGl2aXR5IHBlcnRhaW5zIHRvIHN0cmluZyBjb21wYXJlcyBvbmx5LiBUaGlzIGluY2x1ZGVzIHVudHlwZWQgY29sdW1ucywgY29sdW1ucyB0eXBlZCBhcyBzdHJpbmdzLCB0eXBlZCBjb2x1bW5zIGNvbnRhaW5pbmcgZGF0YSB0aGF0IGNhbm5vdCBiZSBjb2VyY2VkIHRvIHR5cGUgb3Igd2hlbiB0aGUgZmlsdGVyIGV4cHJlc3Npb24gb3BlcmFuZCBjYW5ub3QgYmUgY29lcmNlZC5cbiAgICAgKlxuICAgICAqIE5PVEU6IFRoaXMgaXMgYSBzaGFyZWQgcHJvcGVydHkgYW5kIGFmZmVjdHMgYWxsIGZpbHRlci10cmVlIGluc3RhbmNlcyBjb25zdHJ1Y3RlZCBieSB0aGlzIGNvZGUgaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc1NlbnNpdGl2ZVxuICAgICAqIEBtZW1iZXJPZiBGaWx0ZXJ0cmVlIy5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBzZXQgY2FzZVNlbnNpdGl2ZURhdGEoaXNTZW5zaXRpdmUpIHtcbiAgICAgICAgdmFyIHRvU3RyaW5nID0gaXNTZW5zaXRpdmUgPyB0b1N0cmluZ0Nhc2VTZW5zaXRpdmUgOiB0b1N0cmluZ0Nhc2VJbnNlbnNpdGl2ZTtcbiAgICAgICAgRmlsdGVyTGVhZi5zZXRUb1N0cmluZyh0b1N0cmluZyk7XG4gICAgfVxuXG59KTtcblxuZnVuY3Rpb24gdG9TdHJpbmdDYXNlSW5zZW5zaXRpdmUocykgeyByZXR1cm4gKHMgKyAnJykudG9VcHBlckNhc2UoKTsgfVxuZnVuY3Rpb24gdG9TdHJpbmdDYXNlU2Vuc2l0aXZlKHMpIHsgcmV0dXJuIHMgKyAnJzsgfVxuXG4vLyBTb21lIGV2ZW50IGhhbmRsZXJzIGJvdW5kIHRvIEZpbHRlclRyZWUgb2JqZWN0XG5cbmZ1bmN0aW9uIG9uY2hhbmdlKGV2dCkgeyAvLyBjYWxsZWQgaW4gY29udGV4dFxuICAgIHZhciBjdHJsID0gZXZ0LnRhcmdldDtcbiAgICBpZiAoY3RybC5wYXJlbnRFbGVtZW50ID09PSB0aGlzLmVsKSB7XG4gICAgICAgIGlmIChjdHJsLnZhbHVlID09PSAnc3ViZXhwJykge1xuICAgICAgICAgICAgdGhpcy5jaGlsZHJlbi5wdXNoKG5ldyBGaWx0ZXJUcmVlKHtcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IHRoaXNcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYWRkKHtcbiAgICAgICAgICAgICAgICBzdGF0ZTogeyBlZGl0b3I6IGN0cmwudmFsdWUgfSxcbiAgICAgICAgICAgICAgICBmb2N1czogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY3RybC5zZWxlY3RlZEluZGV4ID0gMDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG9uVHJlZU9wQ2xpY2soZXZ0KSB7IC8vIGNhbGxlZCBpbiBjb250ZXh0XG4gICAgdmFyIGN0cmwgPSBldnQudGFyZ2V0O1xuXG4gICAgaWYgKGN0cmwuY2xhc3NOYW1lID09PSAnZmlsdGVyLXRyZWUtb3AtY2hvaWNlJykge1xuICAgICAgICB0aGlzLm9wZXJhdG9yID0gY3RybC52YWx1ZTtcblxuICAgICAgICAvLyBkaXNwbGF5IHN0cmlrZS10aHJvdWdoXG4gICAgICAgIHZhciByYWRpb0J1dHRvbnMgPSB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ2xhYmVsPmlucHV0LmZpbHRlci10cmVlLW9wLWNob2ljZVtuYW1lPScgKyBjdHJsLm5hbWUgKyAnXScpO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHJhZGlvQnV0dG9ucywgZnVuY3Rpb24oY3RybCkge1xuICAgICAgICAgICAgY3RybC5wYXJlbnRFbGVtZW50LnN0eWxlLnRleHREZWNvcmF0aW9uID0gY3RybC5jaGVja2VkID8gJ25vbmUnIDogJ2xpbmUtdGhyb3VnaCc7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGRpc3BsYXkgb3BlcmF0b3IgYmV0d2VlbiBmaWx0ZXJzIGJ5IGFkZGluZyBvcGVyYXRvciBzdHJpbmcgYXMgYSBDU1MgY2xhc3Mgb2YgdGhpcyB0cmVlXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvcGVyYXRvcnMpIHtcbiAgICAgICAgICAgIHRoaXMuZWwuY2xhc3NMaXN0LnJlbW92ZShrZXkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZWwuY2xhc3NMaXN0LmFkZCh0aGlzLm9wZXJhdG9yKTtcbiAgICB9XG59XG5cbi8qKlxuICogVGhyb3dzIGVycm9yIGlmIGludmFsaWQgZXhwcmVzc2lvbiB0cmVlLlxuICogQ2F1Z2h0IGJ5IHtAbGluayBGaWx0ZXJUcmVlI2ludmFsaWR8RmlsdGVyVHJlZS5wcm90b3R5cGUuaW52YWxpZCgpfS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZm9jdXM9ZmFsc2VdIC0gTW92ZSBmb2N1cyB0byBvZmZlbmRpbmcgY29udHJvbC5cbiAqIEByZXR1cm5zIHt1bmRlZmluZWR9IGlmIHZhbGlkXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBpbnZhbGlkKG9wdGlvbnMpIHsgLy8gY2FsbGVkIGluIGNvbnRleHRcbiAgICAvL2lmICh0aGlzIGluc3RhbmNlb2YgRmlsdGVyVHJlZSAmJiAhdGhpcy5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAvLyAgICB0aHJvdyBuZXcgdGhpcy5FcnJvcignRW1wdHkgc3ViZXhwcmVzc2lvbiAobm8gZmlsdGVycykuJyk7XG4gICAgLy99XG5cbiAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGQpIHtcbiAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgRmlsdGVyTGVhZikge1xuICAgICAgICAgICAgY2hpbGQuaW52YWxpZChvcHRpb25zKTtcbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZC5jaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGludmFsaWQuY2FsbChjaGlsZCwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuRmlsdGVyVHJlZS5leHRlbnNpb25zID0ge1xuICAgIENvbHVtbnM6IHJlcXVpcmUoJy4vZXh0ZW5zaW9ucy9jb2x1bW5zJylcbn07XG5cbi8vIG1vZHVsZSBpbml0aWFsaXphdGlvblxuRmlsdGVyVHJlZS5wcm90b3R5cGUuY2FzZVNlbnNpdGl2ZURhdGEgPSB0cnVlOyAgLy8gZGVmYXVsdCBpcyBjYXNlLXNlbnNpdGl2ZSB3aGljaCBpcyBtb3JlIGVmZmljaWVudDsgbWF5IGJlIHJlc2V0IGF0IHdpbGxcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlclRyZWU7XG4iLCIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGVtcGxleCA9IHJlcXVpcmUoJ3RlbXBsZXgnKTtcblxudmFyIHRlbXBsYXRlcyA9IHJlcXVpcmUoJy4uL2h0bWwnKTtcblxudmFyIGVuY29kZXJzID0gL1xceyhcXGQrKVxcOmVuY29kZVxcfS9nO1xuXG5mdW5jdGlvbiBUZW1wbGF0ZXMoKSB7fVxudmFyIGNvbnN0cnVjdG9yID0gVGVtcGxhdGVzLnByb3RvdHlwZS5jb25zdHJ1Y3RvcjtcblRlbXBsYXRlcy5wcm90b3R5cGUgPSB0ZW1wbGF0ZXM7XG5UZW1wbGF0ZXMucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY29uc3RydWN0b3I7IC8vIHJlc3RvcmUgaXRcblRlbXBsYXRlcy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24odGVtcGxhdGVOYW1lKSB7IC8vIG1peCBpdCBpblxuICAgIHZhciBrZXlzLFxuICAgICAgICBtYXRjaGVzID0ge30sXG4gICAgICAgIHRlbXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICAgICAgdGV4dCA9IHRoaXNbdGVtcGxhdGVOYW1lXSxcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgICBlbmNvZGVycy5sYXN0SW5kZXggPSAwO1xuXG4gICAgd2hpbGUgKChrZXlzID0gZW5jb2RlcnMuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgbWF0Y2hlc1trZXlzWzFdXSA9IHRydWU7XG4gICAgfVxuXG4gICAga2V5cyA9IE9iamVjdC5rZXlzKG1hdGNoZXMpO1xuXG4gICAgaWYgKGtleXMubGVuZ3RoKSB7XG4gICAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHRlbXAudGV4dENvbnRlbnQgPSBhcmdzW2tleV07XG4gICAgICAgICAgICBhcmdzW2tleV0gPSB0ZW1wLmlubmVySFRNTDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoZW5jb2RlcnMsICd7JDF9Jyk7XG4gICAgfVxuXG4gICAgdGVtcC5pbm5lckhUTUwgPSB0ZW1wbGV4LmFwcGx5KHRoaXMsIFt0ZXh0XS5jb25jYXQoYXJncykpO1xuXG4gICAgLy8gaWYgb25seSBvbmUgSFRNTEVsZW1lbnQsIHJldHVybiBpdDsgb3RoZXJ3aXNlIGVudGlyZSBsaXN0IG9mIG5vZGVzXG4gICAgcmV0dXJuIHRlbXAuY2hpbGRyZW4ubGVuZ3RoID09PSAxICYmIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggPT09IDFcbiAgICAgICAgPyB0ZW1wLmZpcnN0Q2hpbGRcbiAgICAgICAgOiB0ZW1wLmNoaWxkTm9kZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIENvbmRpdGlvbmFscyA9IHJlcXVpcmUoJy4uL0NvbmRpdGlvbmFscycpO1xudmFyIEZpbHRlckxlYWYgPSByZXF1aXJlKCcuLi9GaWx0ZXJMZWFmJyk7XG5cbi8qKlxuICogQHN1bW1hcnkgUHJvdG90eXBlIGFkZGl0aW9ucyBvYmplY3QgZm9yIGV4dGVuZGluZyB7QGxpbmsgRmlsdGVyTGVhZn0uXG4gKiBAZGVzYyBSZXN1bHRpbmcgb2JqZWN0IGlzIHNpbWlsYXIgdG8ge0BsaW5rIEZpbHRlckxlYWZ9IGV4Y2VwdDpcbiAqIDEuIFRoZSBgb3BlcmFuZGAgcHJvcGVydHkgbmFtZXMgYW5vdGhlciBjb2x1bW4gcmF0aGVyIHRoYW4gY29udGFpbnMgYSBsaXRlcmFsLlxuICogMi4gT3BlcmF0b3JzIGFyZSBsaW1pdGVkIHRvIGVxdWFsaXR5LCBpbmVxdWFsaXRpZXMsIGFuZCBzZXRzIChJTi9OT1QgSU4pLiBPbWl0dGVkIGFyZSB0aGUgc3RyaW5nIGFuZCBwYXR0ZXJuIHNjYW5zIChCRUdJTlMvTk9UIEJFR0lOUywgRU5EUy9OT1QgRU5EUywgQ09OVEFJTlMvTk9UIENPTlRBSU5TLCBhbmQgTElLRS9OT1QgTElLRSkuXG4gKlxuICogQGV4dGVuZHMgRmlsdGVyTGVhZlxuICpcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBpZGVudGlmaWVyIC0gTmFtZSBvZiBjb2x1bW4gKG1lbWJlciBvZiBkYXRhIHJvdyBvYmplY3QpIHRvIGNvbXBhcmUgYWdhaW5zdCB0aGlzIGNvbHVtbiAobWVtYmVyIG9mIGRhdGEgcm93IG9iamVjdCBuYW1lZCBieSBgY29sdW1uYCkuXG4gKi9cbnZhciBDb2x1bW5MZWFmID0ge1xuICAgIG5hbWU6ICdjb2x1bW4gPSBjb2x1bW4nLCAvLyBkaXNwbGF5IHN0cmluZyBmb3IgZHJvcC1kb3duXG5cbiAgICBjcmVhdGVWaWV3OiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBgdmlld2AgaGFzaCBhbmQgaW5zZXJ0IHRoZSB0aHJlZSBkZWZhdWx0IGVsZW1lbnRzIChgY29sdW1uYCwgYG9wZXJhdG9yYCwgYG9wZXJhbmRgKSBpbnRvIGAuZWxgXG4gICAgICAgIEZpbHRlckxlYWYucHJvdG90eXBlLmNyZWF0ZVZpZXcuY2FsbCh0aGlzKTtcblxuICAgICAgICAvLyBSZXBsYWNlIHRoZSBgb3BlcmFuZGAgZWxlbWVudCBmcm9tIHRoZSBgdmlld2AgaGFzaFxuICAgICAgICB2YXIgb2xkT3BlcmFuZCA9IHRoaXMudmlldy5vcGVyYW5kLFxuICAgICAgICAgICAgbmV3T3BlcmFuZCA9IHRoaXMudmlldy5vcGVyYW5kID0gdGhpcy5tYWtlRWxlbWVudCh0aGlzLnJvb3Quc2NoZW1hLCAnY29sdW1uJywgdGhpcy5zb3J0Q29sdW1uTWVudSk7XG5cbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgb3BlcmFuZCBlbGVtZW50IHdpdGggdGhlIG5ldyBvbmUuIFRoZXJlIGFyZSBubyBldmVudCBsaXN0ZW5lcnMgdG8gd29ycnkgYWJvdXQuXG4gICAgICAgIHRoaXMuZWwucmVwbGFjZUNoaWxkKG5ld09wZXJhbmQsIG9sZE9wZXJhbmQpO1xuICAgIH0sXG5cbiAgICBtYWtlU3FsT3BlcmFuZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJvb3QuY29uZGl0aW9uYWxzLm1ha2VTcWxJZGVudGlmaWVyKHRoaXMub3BlcmFuZCk7XG4gICAgfSxcblxuICAgIG9wTWVudTogW1xuICAgICAgICBDb25kaXRpb25hbHMuZ3JvdXBzLmVxdWFsaXR5LFxuICAgICAgICBDb25kaXRpb25hbHMuZ3JvdXBzLmluZXF1YWxpdGllcyxcbiAgICAgICAgQ29uZGl0aW9uYWxzLmdyb3Vwcy5zZXRzXG4gICAgXSxcblxuICAgIHE6IGZ1bmN0aW9uKGRhdGFSb3cpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsT3JGdW5jKGRhdGFSb3csIHRoaXMub3BlcmFuZCwgdGhpcy5jYWxjdWxhdG9yKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbHVtbkxlYWY7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByZU9wID0gL14oKD18Pj0/fDxbPj1dPyl8KE5PVCApPyhMSUtFfElOKVxcYikvaSwgLy8gbWF0Y2hbMV1cbiAgICByZUZsb2F0ID0gL14oWystXT8oXFxkKyhcXC5cXGQqKT98XFxkKlxcLlxcZCspKGVbKy1dXFxkKyk/KVteXFxkXT8vaSxcbiAgICByZUxpdCA9IC9eJyhcXGQrKScvLFxuICAgIHJlTGl0QW55d2hlcmUgPSAvJyhcXGQrKScvLFxuICAgIHJlSW4gPSAvXlxcKCguKj8pXFwpLyxcbiAgICByZUJvb2wgPSAvXihBTkR8T1IpXFxiL2ksXG4gICAgcmVHcm91cCA9IC9eKE5PVCA/KT9cXCgvaTtcblxudmFyIFNRVCA9ICdcXCcnO1xuXG52YXIgZGVmYXVsdElkUXRzID0ge1xuICAgIGJlZzogJ1wiJyxcbiAgICBlbmQ6ICdcIidcbn07XG5cbmZ1bmN0aW9uIFBhcnNlclNxbEVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuUGFyc2VyU3FsRXJyb3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFcnJvci5wcm90b3R5cGUpO1xuUGFyc2VyU3FsRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnUGFyc2VyU3FsRXJyb3InO1xuXG4vKiogQHR5cGVkZWYge29iamVjdH0gc3FsSWRRdHNPYmplY3RcbiAqIEBkZXNjIE9uIGEgcHJhY3RpY2FsIGxldmVsLCB0aGUgdXNlZnVsIGNoYXJhY3RlcnMgYXJlOlxuICogKiBTUUwtOTIgc3RhbmRhcmQ6IFwiZG91YmxlIHF1b3Rlc1wiXG4gKiAqIFNRTCBTZXJ2ZXI6IFwiZG91YmxlIHF1b3Rlc1wiIG9yIFxcW3NxdWFyZSBicmFja2V0c1xcXVxuICogKiBteVNRTDogXFxgdGljayBtYXJrc1xcYFxuICogQHByb3BlcnR5IHtzdHJpbmd9IGJlZyAtIFRoZSBvcGVuIHF1b3RlIGNoYXJhY3Rlci5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbmQgLSBUaGUgY2xvc2UgcXVvdGUgY2hhcmFjdGVyLlxuICovXG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBTdHJ1Y3R1cmVkIFF1ZXJ5IExhbmd1YWdlIChTUUwpIHBhcnNlclxuICogQGF1dGhvciBKb25hdGhhbiBFaXRlbiA8am9uYXRoYW5Ab3BlbmZpbi5jb20+XG4gKiBAZGVzYyBUaGlzIGlzIGEgc3Vic2V0IG9mIFNRTCBjb25kaXRpb25hbCBleHByZXNzaW9uIHN5bnRheC5cbiAqXG4gKiBAc2VlIHtAbGluayBodHRwczovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L21zMTczNTQ1LmFzcHggU1FMIFNlYXJjaCBDb25kaXRpb259XG4gKlxuICogQHBhcmFtIHttZW51SXRlbVtdfSBbb3B0aW9ucy5zY2hlbWFdIC0gQ29sdW1uIHNjaGVtYSBmb3IgY29sdW1uIG5hbWUgdmFsaWRhdGlvbi4gVGhyb3dzIGFuIGVycm9yIGlmIG5hbWUgZmFpbHMgdmFsaWRhdGlvbiAoYnV0IHNlZSBgcmVzb2x2ZUFsaWFzZXNgKS4gT21pdCB0byBza2lwIGNvbHVtbiBuYW1lIHZhbGlkYXRpb24uXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJlc29sdmVBbGlhc2VzXSAtIFZhbGlkYXRlIGNvbHVtbiBhbGlhc2VzIGFnYWluc3Qgc2NoZW1hIGFuZCB1c2UgdGhlIGFzc29jaWF0ZWQgY29sdW1uIG5hbWUgaW4gdGhlIHJldHVybmVkIGV4cHJlc3Npb24gc3RhdGUgb2JqZWN0LiBSZXF1aXJlcyBgb3B0aW9ucy5zY2hlbWFgLiBUaHJvd3MgZXJyb3IgaWYgbm8gc3VjaCBjb2x1bW4gZm91bmQuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNhc2VTZW5zaXRpdmVDb2x1bW5OYW1lc10gLSBJZ25vcmUgY2FzZSB3aGlsZSB2YWxpZGF0aW5nIGNvbHVtbiBuYW1lcyBhbmQgYWxpYXNlcy5cbiAqIEBwYXJhbSB7c3FsSWRRdHNPYmplY3R9IFtvcHRpb25zLnNxbElkUXRzPXtiZWc6J1wiJyxlbmQ6J1wiJ31dXG4gKi9cbmZ1bmN0aW9uIFBhcnNlclNRTChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICB0aGlzLnNjaGVtYSA9IG9wdGlvbnMuc2NoZW1hO1xuXG4gICAgdmFyIGlkUXRzID0gb3B0aW9ucy5zcWxJZFF0cyB8fCBkZWZhdWx0SWRRdHM7XG4gICAgdGhpcy5yZU5hbWUgPSBuZXcgUmVnRXhwKCdeKCcgKyBpZFF0cy5iZWcgKyAnKC4rPyknICsgaWRRdHMuZW5kICsgJ3woW0EtWl9dW0EtWl9AXFxcXCQjXSopXFxcXGIpJywgJ2knKTsgLy8gbWF0Y2hbMl0gfHwgbWF0Y2hbM11cbn1cblxuUGFyc2VyU1FMLnByb3RvdHlwZSA9IHtcblxuICAgIGNvbnN0cnVjdG9yOiBQYXJzZXJTUUwucHJvdG90eXBlLmNvbnN0cnVjdG9yLFxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNxbFxuICAgICAqIEByZXR1cm5zIHsqfVxuICAgICAqIEBtZW1iZXJPZiBtb2R1bGU6c3FsU2VhcmNoQ29uZGl0aW9uXG4gICAgICovXG4gICAgcGFyc2U6IGZ1bmN0aW9uKHNxbCkge1xuICAgICAgICB2YXIgc3RhdGU7XG5cbiAgICAgICAgLy8gcmVkdWNlIGFsbCBydW5zIG9mIHdoaXRlIHNwYWNlIHRvIGEgc2luZ2xlIHNwYWNlOyB0aGVuIHRyaW1cbiAgICAgICAgc3FsID0gc3FsLnJlcGxhY2UoL1xcc1xccysvZywgJyAnKS50cmltKCk7XG5cbiAgICAgICAgc3FsID0gc3RyaXBMaXRlcmFscy5jYWxsKHRoaXMsIHNxbCk7XG4gICAgICAgIHN0YXRlID0gd2Fsay5jYWxsKHRoaXMsIHNxbCk7XG5cbiAgICAgICAgaWYgKCFzdGF0ZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgc3RhdGUgPSB7IGNoaWxkcmVuOiBbIHN0YXRlIF0gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiB3YWxrKHQpIHtcbiAgICB2YXIgbSwgbmFtZSwgb3AsIG9wZXJhbmQsIGVkaXRvciwgYm9vbCwgdG9rZW4sIHRva2VucyA9IFtdO1xuICAgIHZhciBpID0gMDtcblxuICAgIHQgPSB0LnRyaW0oKTtcblxuICAgIHdoaWxlIChpIDwgdC5sZW5ndGgpIHtcbiAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlR3JvdXApO1xuICAgICAgICBpZiAobSkge1xuICAgICAgICAgICAgdmFyIG5vdCA9ICEhbVsxXTtcblxuICAgICAgICAgICAgaSArPSBtWzBdLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSBpLCB2ID0gMTsgaiA8IHQubGVuZ3RoICYmIHY7ICsraikge1xuICAgICAgICAgICAgICAgIGlmICh0W2pdID09PSAnKCcpIHtcbiAgICAgICAgICAgICAgICAgICAgKyt2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodFtqXSA9PT0gJyknKSB7XG4gICAgICAgICAgICAgICAgICAgIC0tdjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBcIilcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB3YWxrLmNhbGwodGhpcywgdC5zdWJzdHIoaSwgaiAtIDEgLSBpKSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRva2VuICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vdCkge1xuICAgICAgICAgICAgICAgIGlmICh0b2tlbi5vcGVyYXRvciAhPT0gJ29wLW9yJykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIE9SIGluIE5PVCguLi4pIHN1YmV4cHJlc3Npb24gYnV0IGZvdW5kICcgKyB0b2tlbi5vcGVyYXRvci5zdWJzdHIoMykudG9VcHBlckNhc2UoKSArICcuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRva2VuLm9wZXJhdG9yID0gJ29wLW5vcic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGkgPSBqO1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBjb2x1bW46XG5cbiAgICAgICAgICAgIG0gPSB0LnN1YnN0cihpKS5tYXRjaCh0aGlzLnJlTmFtZSk7XG4gICAgICAgICAgICBpZiAoIW0pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIGlkZW50aWZpZXIgb3IgcXVvdGVkIGlkZW50aWZpZXIuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuYW1lID0gbVsyXSB8fCBtWzNdO1xuICAgICAgICAgICAgaWYgKCEvXltBLVpfXS9pLnRlc3QodFtpXSkpIHsgaSArPSAyOyB9XG4gICAgICAgICAgICBpICs9IG5hbWUubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBvcGVyYXRvcjpcblxuICAgICAgICAgICAgaWYgKHRbaV0gPT09ICcgJykgeyArK2k7IH1cbiAgICAgICAgICAgIG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZU9wKTtcbiAgICAgICAgICAgIGlmICghbSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgcmVsYXRpb25hbCBvcGVyYXRvci4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9wID0gbVsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgaSArPSBvcC5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIG9wZXJhbmQ6XG5cbiAgICAgICAgICAgIGVkaXRvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmICh0W2ldID09PSAnICcpIHsgKytpOyB9XG4gICAgICAgICAgICBpZiAobVs0XSAmJiBtWzRdLnRvVXBwZXJDYXNlKCkgPT09ICdJTicpIHtcbiAgICAgICAgICAgICAgICBtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVJbik7XG4gICAgICAgICAgICAgICAgaWYgKCFtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgcGFyZW50aGVzaXplZCBsaXN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcGVyYW5kID0gbVsxXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoICsgMjtcbiAgICAgICAgICAgICAgICB3aGlsZSAoKG0gPSBvcGVyYW5kLm1hdGNoKHJlTGl0QW55d2hlcmUpKSkge1xuICAgICAgICAgICAgICAgICAgICBvcGVyYW5kID0gb3BlcmFuZC5yZXBsYWNlKHJlTGl0QW55d2hlcmUsIHRoaXMubGl0ZXJhbHNbbVsxXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKG0gPSB0LnN1YnN0cihpKS5tYXRjaChyZUxpdCkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMV07XG4gICAgICAgICAgICAgICAgaSArPSBvcGVyYW5kLmxlbmd0aCArIDI7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IHRoaXMubGl0ZXJhbHNbb3BlcmFuZF07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKChtID0gdC5zdWJzdHIoaSkubWF0Y2gocmVGbG9hdCkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMV07XG4gICAgICAgICAgICAgICAgaSArPSBvcGVyYW5kLmxlbmd0aDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoKG0gPSB0LnN1YnN0cihpKS5tYXRjaCh0aGlzLnJlTmFtZSkpKSB7XG4gICAgICAgICAgICAgICAgb3BlcmFuZCA9IG1bMl0gfHwgbVszXTtcbiAgICAgICAgICAgICAgICBpICs9IG9wZXJhbmQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGVkaXRvciA9ICdDb2x1bW5zJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlclNxbEVycm9yKCdFeHBlY3RlZCBudW1iZXIgb3Igc3RyaW5nIGxpdGVyYWwgb3IgY29sdW1uLicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5zY2hlbWEpIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gbG9va3VwLmNhbGwodGhpcywgbmFtZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wZXJhbmQgPSBsb29rdXAuY2FsbCh0aGlzLCBvcGVyYW5kKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRva2VuID0ge1xuICAgICAgICAgICAgICAgIGNvbHVtbjogbmFtZSxcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogb3AsXG4gICAgICAgICAgICAgICAgb3BlcmFuZDogb3BlcmFuZFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGVkaXRvcikge1xuICAgICAgICAgICAgICAgIHRva2VuLmVkaXRvciA9IGVkaXRvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRva2Vucy5wdXNoKHRva2VuKTtcblxuICAgICAgICBpZiAoaSA8IHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAodFtpXSA9PT0gJyAnKSB7ICsraTsgfVxuICAgICAgICAgICAgbSA9IHQuc3Vic3RyKGkpLm1hdGNoKHJlQm9vbCk7XG4gICAgICAgICAgICBpZiAoIW0pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IoJ0V4cGVjdGVkIGJvb2xlYW4gb3BlcmF0b3IuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib29sID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaSArPSBib29sLmxlbmd0aDtcbiAgICAgICAgICAgIGJvb2wgPSAnb3AtJyArIGJvb2w7XG4gICAgICAgICAgICBpZiAodG9rZW5zLm9wZXJhdG9yICYmIHRva2Vucy5vcGVyYXRvciAhPT0gYm9vbCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgc2FtZSBib29sZWFuIG9wZXJhdG9yIHRocm91Z2hvdXQgc3ViZXhwcmVzc2lvbi4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2Vucy5vcGVyYXRvciA9IGJvb2w7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodFtpXSA9PT0gJyAnKSB7ICsraTsgfVxuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICAgIHRva2Vucy5sZW5ndGggPT09IDEgPyB0b2tlbnNbMF0gOiB7XG4gICAgICAgICAgICBvcGVyYXRvcjogdG9rZW5zLm9wZXJhdG9yLFxuICAgICAgICAgICAgY2hpbGRyZW46IHRva2Vuc1xuICAgICAgICB9XG4gICAgKTtcbn1cblxuZnVuY3Rpb24gbG9va3VwKG5hbWUpIHtcbiAgICB2YXIgaXRlbSA9IHRoaXMuc2NoZW1hLmxvb2t1cChuYW1lKTtcblxuICAgIGlmICghaXRlbSkge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2VyU3FsRXJyb3IodGhpcy5yZXNvbHZlQWxpYXNlc1xuICAgICAgICAgICAgPyAnRXhwZWN0ZWQgdmFsaWQgY29sdW1uIG5hbWUuJ1xuICAgICAgICAgICAgOiAnRXhwZWN0ZWQgdmFsaWQgY29sdW1uIG5hbWUgb3IgYWxpYXMuJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBpdGVtLm5hbWU7XG59XG5cbmZ1bmN0aW9uIHN0cmlwTGl0ZXJhbHModCkge1xuICAgIHZhciBpID0gMCwgaiA9IDAsIGs7XG5cbiAgICB0aGlzLmxpdGVyYWxzID0gW107XG5cbiAgICB3aGlsZSAoKGogPSB0LmluZGV4T2YoU1FULCBqKSkgPj0gMCkge1xuICAgICAgICBrID0gajtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgayA9IHQuaW5kZXhPZihTUVQsIGsgKyAxKTtcbiAgICAgICAgICAgIGlmIChrIDwgMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZXJTcWxFcnJvcignRXhwZWN0ZWQgJyArIFNRVCArICcgKHNpbmdsZSBxdW90ZSkuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gd2hpbGUgKHRbKytrXSA9PT0gU1FUKTtcbiAgICAgICAgdGhpcy5saXRlcmFscy5wdXNoKHQuc2xpY2UoKytqLCAtLWspLnJlcGxhY2UoLycnL2csIFNRVCkpO1xuICAgICAgICB0ID0gdC5zdWJzdHIoMCwgaikgKyBpICsgdC5zdWJzdHIoayk7XG4gICAgICAgIGogPSBqICsgMSArIChpICsgJycpLmxlbmd0aCArIDE7XG4gICAgICAgIGkrKztcbiAgICB9XG5cbiAgICByZXR1cm4gdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQYXJzZXJTUUw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjc3NJbmplY3RvciA9IHJlcXVpcmUoJ2Nzcy1pbmplY3RvcicpO1xuXG52YXIgY3NzOyAvLyBkZWZpbmVkIGJ5IGNvZGUgaW5zZXJ0ZWQgYnkgZ3VscGZpbGUgYmV0d2VlbiBmb2xsb3dpbmcgY29tbWVudHNcbi8qIGluamVjdDpjc3MgKi9cbmNzcyA9ICcuZmlsdGVyLXRyZWV7Zm9udC1mYW1pbHk6c2Fucy1zZXJpZjtmb250LXNpemU6MTBwdDtsaW5lLWhlaWdodDoxLjVlbX0uZmlsdGVyLXRyZWUgbGFiZWx7Zm9udC13ZWlnaHQ6NDAwfS5maWx0ZXItdHJlZSBpbnB1dFt0eXBlPWNoZWNrYm94XSwuZmlsdGVyLXRyZWUgaW5wdXRbdHlwZT1yYWRpb117bWFyZ2luLWxlZnQ6M3B4O21hcmdpbi1yaWdodDozcHh9LmZpbHRlci10cmVlIG9se21hcmdpbi10b3A6MH0uZmlsdGVyLXRyZWU+c2VsZWN0e2Zsb2F0OnJpZ2h0O2JvcmRlcjoxcHggZG90dGVkIGdyZXk7YmFja2dyb3VuZC1jb2xvcjp0cmFuc3BhcmVudDtib3gtc2hhZG93Om5vbmV9LmZpbHRlci10cmVlLXJlbW92ZS1idXR0b257ZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MTVweDtoZWlnaHQ6MTVweDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kLWNvbG9yOiNlODg7Zm9udC1zaXplOjExLjVweDtjb2xvcjojZmZmO3RleHQtYWxpZ246Y2VudGVyO2xpbmUtaGVpZ2h0Om5vcm1hbDtmb250LXN0eWxlOm5vcm1hbDtmb250LWZhbWlseTpzYW5zLXNlcmlmO21hcmdpbi1yaWdodDo0cHg7Y3Vyc29yOnBvaW50ZXJ9LmZpbHRlci10cmVlLXJlbW92ZS1idXR0b246aG92ZXJ7YmFja2dyb3VuZC1jb2xvcjp0cmFuc3BhcmVudDtjb2xvcjojZTg4O2ZvbnQtd2VpZ2h0OjcwMDtib3gtc2hhZG93OnJlZCAwIDAgMnB4IGluc2V0fS5maWx0ZXItdHJlZS1yZW1vdmUtYnV0dG9uOjpiZWZvcmV7Y29udGVudDpcXCdcXFxcZDdcXCd9LmZpbHRlci10cmVlIGxpOjphZnRlcntmb250LXNpemU6NzAlO2ZvbnQtc3R5bGU6aXRhbGljO2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjojMDgwfS5maWx0ZXItdHJlZT5vbD5saTpsYXN0LWNoaWxkOjphZnRlcntkaXNwbGF5Om5vbmV9Lm9wLWFuZD5vbCwub3Atbm9yPm9sLC5vcC1vcj5vbHtwYWRkaW5nLWxlZnQ6NXB4O21hcmdpbi1sZWZ0OjI3cHh9Lm9wLW9yPm9sPmxpOjphZnRlcnttYXJnaW4tbGVmdDoyLjVlbTtjb250ZW50OlxcJ+KAlCBPUiDigJRcXCd9Lm9wLWFuZD5vbD5saTo6YWZ0ZXJ7bWFyZ2luLWxlZnQ6Mi41ZW07Y29udGVudDpcXCfigJQgQU5EIOKAlFxcJ30ub3Atbm9yPm9sPmxpOjphZnRlcnttYXJnaW4tbGVmdDoyLjVlbTtjb250ZW50OlxcJ+KAlCBOT1Ig4oCUXFwnfS5maWx0ZXItdHJlZS1lZGl0b3I+Kntmb250LXdlaWdodDo3MDB9LmZpbHRlci10cmVlLWVkaXRvcj5zcGFue2ZvbnQtc2l6ZTpzbWFsbGVyfS5maWx0ZXItdHJlZS1lZGl0b3I+aW5wdXRbdHlwZT10ZXh0XXt3aWR0aDo4ZW07cGFkZGluZzoxcHggNXB4IDJweH0uZmlsdGVyLXRyZWUtd2FybmluZ3tiYWNrZ3JvdW5kLWNvbG9yOiNmZmMhaW1wb3J0YW50O2JvcmRlci1jb2xvcjojZWRiIWltcG9ydGFudDtmb250LXdlaWdodDo0MDAhaW1wb3J0YW50fS5maWx0ZXItdHJlZS1lcnJvcntiYWNrZ3JvdW5kLWNvbG9yOiNmY2MhaW1wb3J0YW50O2JvcmRlci1jb2xvcjojYzk5IWltcG9ydGFudDtmb250LXdlaWdodDo0MDAhaW1wb3J0YW50fS5maWx0ZXItdHJlZS1kZWZhdWx0PjplbmFibGVke21hcmdpbjowIC40ZW07YmFja2dyb3VuZC1jb2xvcjojZGRkO2JvcmRlcjoxcHggc29saWQgdHJhbnNwYXJlbnR9LmZpbHRlci10cmVlLmZpbHRlci10cmVlLXR5cGUtY29sdW1uLWZpbHRlcnM+b2w+bGk6bm90KDpsYXN0LWNoaWxkKXtwYWRkaW5nLWJvdHRvbTouNzVlbTtib3JkZXItYm90dG9tOjNweCBkb3VibGUgIzA4MDttYXJnaW4tYm90dG9tOi43NWVtfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVze21hcmdpbjowIDAgNnB4O2ZvbnQtc2l6ZTo4cHQ7Zm9udC13ZWlnaHQ6NDAwO2xpbmUtaGVpZ2h0Om5vcm1hbDt3aGl0ZS1zcGFjZTpub3JtYWw7Y29sb3I6I2MwMH0uZmlsdGVyLXRyZWUgLmZvb3Rub3Rlcz5we21hcmdpbjowfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVzPnVse21hcmdpbjotM3B4IDAgMDtwYWRkaW5nLWxlZnQ6MTdweDt0ZXh0LWluZGV4Oi02cHh9LmZpbHRlci10cmVlIC5mb290bm90ZXM+dWw+bGl7bWFyZ2luOjJweCAwfS5maWx0ZXItdHJlZSAuZm9vdG5vdGVzIC5maWVsZC1uYW1lLC5maWx0ZXItdHJlZSAuZm9vdG5vdGVzIC5maWVsZC12YWx1ZXtmb250LXdlaWdodDo3MDA7Zm9udC1zdHlsZTpub3JtYWx9LmZpbHRlci10cmVlIC5mb290bm90ZXMgLmZpZWxkLXZhbHVle2ZvbnQtZmFtaWx5Om1vbm9zcGFjZTtjb2xvcjojMDAwO2JhY2tncm91bmQtY29sb3I6I2RkZDtwYWRkaW5nOjAgNXB4O21hcmdpbjowIDNweDtib3JkZXItcmFkaXVzOjNweH0nO1xuLyogZW5kaW5qZWN0ICovXG5cbm1vZHVsZS5leHBvcnRzID0gY3NzSW5qZWN0b3IuYmluZCh0aGlzLCBjc3MsICdmaWx0ZXItdHJlZS1iYXNlJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKiBAdHlwZWRlZiB7ZnVuY3Rpb259IG9wZXJhdGlvblJlZHVjZXJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gcFxuICogQHBhcmFtIHtib29sZWFufSBxXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVGhlIHJlc3VsdCBvZiBhcHBseWluZyB0aGUgb3BlcmF0b3IgdG8gdGhlIHR3byBwYXJhbWV0ZXJzLlxuICovXG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtvcGVyYXRpb25SZWR1Y2VyfVxuICovXG5mdW5jdGlvbiBBTkQocCwgcSkge1xuICAgIHJldHVybiBwICYmIHE7XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqIEB0eXBlIHtvcGVyYXRpb25SZWR1Y2VyfVxuICovXG5mdW5jdGlvbiBPUihwLCBxKSB7XG4gICAgcmV0dXJuIHAgfHwgcTtcbn1cblxuLyoqIEB0eXBlZGVmIHtvYmVqY3R9IHRyZWVPcGVyYXRvclxuICogQGRlc2MgRWFjaCBgdHJlZU9wZXJhdG9yYCBvYmplY3QgZGVzY3JpYmVzIHR3byB0aGluZ3M6XG4gKlxuICogMS4gSG93IHRvIHRha2UgdGhlIHRlc3QgcmVzdWx0cyBvZiBfbl8gY2hpbGQgbm9kZXMgYnkgYXBwbHlpbmcgdGhlIG9wZXJhdG9yIHRvIGFsbCB0aGUgcmVzdWx0cyB0byBcInJlZHVjZVwiIGl0IGRvd24gdG8gYSBzaW5nbGUgcmVzdWx0LlxuICogMi4gSG93IHRvIGdlbmVyYXRlIFNRTCBXSEVSRSBjbGF1c2Ugc3ludGF4IHRoYXQgYXBwbGllcyB0aGUgb3BlcmF0b3IgdG8gX25fIGNoaWxkIG5vZGVzLlxuICpcbiAqIEBwcm9wZXJ0eSB7b3BlcmF0aW9uUmVkdWNlcn0gcmVkdWNlXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNlZWQgLVxuICogQHByb3BlcnR5IHtib29sZWFufSBhYm9ydCAtXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG5lZ2F0ZSAtXG4gKiBAcHJvcGVydHkge3N0cmluZ30gU1FMLm9wIC1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTUUwuYmVnIC1cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBTUUwuZW5kIC1cbiAqL1xuXG4vKiogQSBoYXNoIG9mIHtAbGluayB0cmVlT3BlcmF0b3J9IG9iamVjdHMuXG4gKiBAdHlwZSB7b2JqZWN0fVxuICovXG52YXIgdHJlZU9wZXJhdG9ycyA9IHtcbiAgICAnb3AtYW5kJzoge1xuICAgICAgICByZWR1Y2U6IEFORCxcbiAgICAgICAgc2VlZDogdHJ1ZSxcbiAgICAgICAgYWJvcnQ6IGZhbHNlLFxuICAgICAgICBuZWdhdGU6IGZhbHNlLFxuICAgICAgICBTUUw6IHtcbiAgICAgICAgICAgIG9wOiAnQU5EJyxcbiAgICAgICAgICAgIGJlZzogJygnLFxuICAgICAgICAgICAgZW5kOiAnKSdcbiAgICAgICAgfVxuICAgIH0sXG4gICAgJ29wLW9yJzoge1xuICAgICAgICByZWR1Y2U6IE9SLFxuICAgICAgICBzZWVkOiBmYWxzZSxcbiAgICAgICAgYWJvcnQ6IHRydWUsXG4gICAgICAgIG5lZ2F0ZTogZmFsc2UsXG4gICAgICAgIFNRTDoge1xuICAgICAgICAgICAgb3A6ICdPUicsXG4gICAgICAgICAgICBiZWc6ICcoJyxcbiAgICAgICAgICAgIGVuZDogJyknXG4gICAgICAgIH1cbiAgICB9LFxuICAgICdvcC1ub3InOiB7XG4gICAgICAgIHJlZHVjZTogT1IsXG4gICAgICAgIHNlZWQ6IGZhbHNlLFxuICAgICAgICBhYm9ydDogdHJ1ZSxcbiAgICAgICAgbmVnYXRlOiB0cnVlLFxuICAgICAgICBTUUw6IHtcbiAgICAgICAgICAgIG9wOiAnT1InLFxuICAgICAgICAgICAgYmVnOiAnTk9UICgnLFxuICAgICAgICAgICAgZW5kOiAnKSdcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdHJlZU9wZXJhdG9ycztcbiIsIi8qIG9iamVjdC1pdGVyYXRvcnMuanMgLSBNaW5pIFVuZGVyc2NvcmUgbGlicmFyeVxuICogYnkgSm9uYXRoYW4gRWl0ZW5cbiAqXG4gKiBUaGUgbWV0aG9kcyBiZWxvdyBvcGVyYXRlIG9uIG9iamVjdHMgKGJ1dCBub3QgYXJyYXlzKSBzaW1pbGFybHlcbiAqIHRvIFVuZGVyc2NvcmUgKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNjb2xsZWN0aW9ucykuXG4gKlxuICogRm9yIG1vcmUgaW5mb3JtYXRpb246XG4gKiBodHRwczovL2dpdGh1Yi5jb20vam9uZWl0L29iamVjdC1pdGVyYXRvcnNcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3Igb25lIG1ldGhvZCBjYWxsLlxuICogQERlc2MgTm90ZSB0aGF0IHRoZSBgbmV3YCBrZXl3b3JkIGlzIG5vdCBuZWNlc3NhcnkuXG4gKiBAcGFyYW0ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gb2JqZWN0IC0gYG51bGxgIG9yIGB1bmRlZmluZWRgIGlzIHRyZWF0ZWQgYXMgYW4gZW1wdHkgcGxhaW4gb2JqZWN0LlxuICogQHJldHVybiB7V3JhcHBlcn0gVGhlIHdyYXBwZWQgb2JqZWN0LlxuICovXG5mdW5jdGlvbiBXcmFwcGVyKG9iamVjdCkge1xuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBXcmFwcGVyKSB7XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBXcmFwcGVyKSkge1xuICAgICAgICByZXR1cm4gbmV3IFdyYXBwZXIob2JqZWN0KTtcbiAgICB9XG4gICAgdGhpcy5vcmlnaW5hbFZhbHVlID0gb2JqZWN0O1xuICAgIHRoaXMubyA9IG9iamVjdCB8fCB7fTtcbn1cblxuLyoqXG4gKiBAbmFtZSBXcmFwcGVyLmNoYWluXG4gKiBAc3VtbWFyeSBXcmFwIGFuIG9iamVjdCBmb3IgYSBjaGFpbiBvZiBtZXRob2QgY2FsbHMuXG4gKiBARGVzYyBDYWxscyB0aGUgY29uc3RydWN0b3IgYFdyYXBwZXIoKWAgYW5kIG1vZGlmaWVzIHRoZSB3cmFwcGVyIGZvciBjaGFpbmluZy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3RcbiAqIEByZXR1cm4ge1dyYXBwZXJ9IFRoZSB3cmFwcGVkIG9iamVjdC5cbiAqL1xuV3JhcHBlci5jaGFpbiA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICB2YXIgd3JhcHBlZCA9IFdyYXBwZXIob2JqZWN0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgd3JhcHBlZC5jaGFpbmluZyA9IHRydWU7XG4gICAgcmV0dXJuIHdyYXBwZWQ7XG59O1xuXG5XcmFwcGVyLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBVbndyYXAgYW4gb2JqZWN0IHdyYXBwZWQgd2l0aCB7QGxpbmsgV3JhcHBlci5jaGFpbnxXcmFwcGVyLmNoYWluKCl9LlxuICAgICAqIEByZXR1cm4ge29iamVjdHxudWxsfHVuZGVmaW5lZH0gVGhlIHZhbHVlIG9yaWdpbmFsbHkgd3JhcHBlZCBieSB0aGUgY29uc3RydWN0b3IuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3JpZ2luYWxWYWx1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbZWFjaF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2VhY2gpIG1ldGhvZDogSXRlcmF0ZSBvdmVyIHRoZSBtZW1iZXJzIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgY2FsbGluZyBgaXRlcmF0ZWUoKWAgd2l0aCBlYWNoLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM6IGAodmFsdWUsIGtleSwgb2JqZWN0KWAuIFRoZSByZXR1cm4gdmFsdWUgb2YgdGhpcyBmdW5jdGlvbiBpcyB1bmRlZmluZWQ7IGFuIGAuZWFjaGAgbG9vcCBjYW5ub3QgYmUgYnJva2VuIG91dCBvZiAodXNlIHtAbGluayBXcmFwcGVyI2ZpbmR8LmZpbmR9IGluc3RlYWQpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHtXcmFwcGVyfSBUaGUgd3JhcHBlZCBvYmplY3QgZm9yIGNoYWluaW5nLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGVhY2g6IGZ1bmN0aW9uIChpdGVyYXRlZSwgY29udGV4dCkge1xuICAgICAgICB2YXIgbyA9IHRoaXMubztcbiAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpdGVyYXRlZS5jYWxsKHRoaXMsIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2ZpbmRdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaW5kKSBtZXRob2Q6IExvb2sgdGhyb3VnaCBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHJldHVybmluZyB0aGUgZmlyc3Qgb25lIHRoYXQgcGFzc2VzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBgdW5kZWZpbmVkYCBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiByZXR1cm5zIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgYWNjZXB0YWJsZSBtZW1iZXIsIGFuZCBkb2Vzbid0IG5lY2Vzc2FyaWx5IHRyYXZlcnNlIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IFRoZSBmb3VuZCBwcm9wZXJ0eSdzIHZhbHVlLCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIGZpbmQ6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgICByZXN1bHQgPSBPYmplY3Qua2V5cyhvKS5maW5kKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlZGljYXRlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pO1xuICAgICAgICAgICAgfSwgY29udGV4dCB8fCBvKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG9bcmVzdWx0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtmaWx0ZXJdKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNmaWx0ZXIpIG1ldGhvZDogTG9vayB0aHJvdWdoIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgcmV0dXJuaW5nIHRoZSB2YWx1ZXMgb2YgYWxsIG1lbWJlcnMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdCAoYHByZWRpY2F0ZWApLCBvciBlbXB0eSBhcnJheSBpZiBubyB2YWx1ZSBwYXNzZXMgdGhlIHRlc3QuIFRoZSBmdW5jdGlvbiBhbHdheXMgdHJhdmVyc2VzIHRoZSBlbnRpcmUgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IHByZWRpY2F0ZSAtIEZvciBlYWNoIG1lbWJlciBvZiB0aGUgd3JhcHBlZCBvYmplY3QsIHRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIHdpdGggdGhyZWUgYXJndW1lbnRzOiBgKHZhbHVlLCBrZXksIG9iamVjdClgLiBUaGUgcmV0dXJuIHZhbHVlIG9mIHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIHRydXRoeSBpZiB0aGUgbWVtYmVyIHBhc3NlcyB0aGUgdGVzdCBhbmQgZmFsc3kgb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYHByZWRpY2F0ZWAgaXMgYm91bmQgdG8gdGhpcyBvYmplY3QuIEluIG90aGVyIHdvcmRzLCB0aGlzIG9iamVjdCBiZWNvbWVzIHRoZSBgdGhpc2AgdmFsdWUgaW4gdGhlIGNhbGxzIHRvIGBwcmVkaWNhdGVgLiAoT3RoZXJ3aXNlLCB0aGUgYHRoaXNgIHZhbHVlIHdpbGwgYmUgdGhlIHVud3JhcHBlZCBvYmplY3QuKVxuICAgICAqIEByZXR1cm4geyp9IEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGZpbHRlcmVkIHZhbHVlcy5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBmaWx0ZXI6IGZ1bmN0aW9uIChwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChwcmVkaWNhdGUuY2FsbCh0aGlzLCBvW2tleV0sIGtleSwgbykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2gob1trZXldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBjb250ZXh0IHx8IG8pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW21hcF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI21hcCkgbWV0aG9kOiBQcm9kdWNlcyBhIG5ldyBhcnJheSBvZiB2YWx1ZXMgYnkgbWFwcGluZyBlYWNoIHZhbHVlIGluIGxpc3QgdGhyb3VnaCBhIHRyYW5zZm9ybWF0aW9uIGZ1bmN0aW9uIChgaXRlcmF0ZWVgKS4gVGhlIGZ1bmN0aW9uIGFsd2F5cyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBvYmplY3QuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gaXRlcmF0ZWUgLSBGb3IgZWFjaCBtZW1iZXIgb2YgdGhlIHdyYXBwZWQgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRocmVlIGFyZ3VtZW50czogYCh2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIGNvbmNhdGVuYXRlZCB0byB0aGUgZW5kIG9mIHRoZSBuZXcgYXJyYXkuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtjb250ZXh0XSAtIElmIGdpdmVuLCBgaXRlcmF0ZWVgIGlzIGJvdW5kIHRvIHRoaXMgb2JqZWN0LiBJbiBvdGhlciB3b3JkcywgdGhpcyBvYmplY3QgYmVjb21lcyB0aGUgYHRoaXNgIHZhbHVlIGluIHRoZSBjYWxscyB0byBgcHJlZGljYXRlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBBbiBhcnJheSBjb250YWluaW5nIHRoZSBmaWx0ZXJlZCB2YWx1ZXMuXG4gICAgICogQG1lbWJlck9mIFdyYXBwZXIucHJvdG90eXBlXG4gICAgICovXG4gICAgbWFwOiBmdW5jdGlvbiAoaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgICAgaWYgKG8pIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG8pLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGl0ZXJhdGVlLmNhbGwodGhpcywgb1trZXldLCBrZXksIG8pKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGRlc2MgTWltaWNzIFVuZGVyc2NvcmUncyBbcmVkdWNlXShodHRwOi8vdW5kZXJzY29yZWpzLm9yZy8jcmVkdWNlKSBtZXRob2Q6IEJvaWwgZG93biB0aGUgdmFsdWVzIG9mIGFsbCB0aGUgbWVtYmVycyBvZiB0aGUgd3JhcHBlZCBvYmplY3QgaW50byBhIHNpbmdsZSB2YWx1ZS4gYG1lbW9gIGlzIHRoZSBpbml0aWFsIHN0YXRlIG9mIHRoZSByZWR1Y3Rpb24sIGFuZCBlYWNoIHN1Y2Nlc3NpdmUgc3RlcCBvZiBpdCBzaG91bGQgYmUgcmV0dXJuZWQgYnkgYGl0ZXJhdGVlKClgLlxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGl0ZXJhdGVlIC0gRm9yIGVhY2ggbWVtYmVyIG9mIHRoZSB3cmFwcGVkIG9iamVjdCwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBmb3VyIGFyZ3VtZW50czogYChtZW1vLCB2YWx1ZSwga2V5LCBvYmplY3QpYC4gVGhlIHJldHVybiB2YWx1ZSBvZiB0aGlzIGZ1bmN0aW9uIGJlY29tZXMgdGhlIG5ldyB2YWx1ZSBvZiBgbWVtb2AgZm9yIHRoZSBuZXh0IGl0ZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0geyp9IFttZW1vXSAtIElmIG5vIG1lbW8gaXMgcGFzc2VkIHRvIHRoZSBpbml0aWFsIGludm9jYXRpb24gb2YgcmVkdWNlLCB0aGUgaXRlcmF0ZWUgaXMgbm90IGludm9rZWQgb24gdGhlIGZpcnN0IGVsZW1lbnQgb2YgdGhlIGxpc3QuIFRoZSBmaXJzdCBlbGVtZW50IGlzIGluc3RlYWQgcGFzc2VkIGFzIHRoZSBtZW1vIGluIHRoZSBpbnZvY2F0aW9uIG9mIHRoZSBpdGVyYXRlZSBvbiB0aGUgbmV4dCBlbGVtZW50IGluIHRoZSBsaXN0LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbY29udGV4dF0gLSBJZiBnaXZlbiwgYGl0ZXJhdGVlYCBpcyBib3VuZCB0byB0aGlzIG9iamVjdC4gSW4gb3RoZXIgd29yZHMsIHRoaXMgb2JqZWN0IGJlY29tZXMgdGhlIGB0aGlzYCB2YWx1ZSBpbiB0aGUgY2FsbHMgdG8gYGl0ZXJhdGVlYC4gKE90aGVyd2lzZSwgdGhlIGB0aGlzYCB2YWx1ZSB3aWxsIGJlIHRoZSB1bndyYXBwZWQgb2JqZWN0LilcbiAgICAgKiBAcmV0dXJuIHsqfSBUaGUgdmFsdWUgb2YgYG1lbW9gIFwicmVkdWNlZFwiIGFzIHBlciBgaXRlcmF0ZWVgLlxuICAgICAqIEBtZW1iZXJPZiBXcmFwcGVyLnByb3RvdHlwZVxuICAgICAqL1xuICAgIHJlZHVjZTogZnVuY3Rpb24gKGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgICAgIHZhciBvID0gdGhpcy5vO1xuICAgICAgICBpZiAobykge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobykuZm9yRWFjaChmdW5jdGlvbiAoa2V5LCBpZHgpIHtcbiAgICAgICAgICAgICAgICBtZW1vID0gKCFpZHggJiYgbWVtbyA9PT0gdW5kZWZpbmVkKSA/IG9ba2V5XSA6IGl0ZXJhdGVlKG1lbW8sIG9ba2V5XSwga2V5LCBvKTtcbiAgICAgICAgICAgIH0sIGNvbnRleHQgfHwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIE1pbWljcyBVbmRlcnNjb3JlJ3MgW2V4dGVuZF0oaHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvI2V4dGVuZCkgbWV0aG9kOiBDb3B5IGFsbCBvZiB0aGUgcHJvcGVydGllcyBpbiBlYWNoIG9mIHRoZSBgc291cmNlYCBvYmplY3QgcGFyYW1ldGVyKHMpIG92ZXIgdG8gdGhlICh3cmFwcGVkKSBkZXN0aW5hdGlvbiBvYmplY3QgKHRodXMgbXV0YXRpbmcgaXQpLiBJdCdzIGluLW9yZGVyLCBzbyB0aGUgcHJvcGVydGllcyBvZiB0aGUgbGFzdCBgc291cmNlYCBvYmplY3Qgd2lsbCBvdmVycmlkZSBwcm9wZXJ0aWVzIHdpdGggdGhlIHNhbWUgbmFtZSBpbiBwcmV2aW91cyBhcmd1bWVudHMgb3IgaW4gdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiA+IFRoaXMgbWV0aG9kIGNvcGllcyBvd24gbWVtYmVycyBhcyB3ZWxsIGFzIG1lbWJlcnMgaW5oZXJpdGVkIGZyb20gcHJvdG90eXBlIGNoYWluLlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmQ6IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAob2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBvW2tleV0gPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBNaW1pY3MgVW5kZXJzY29yZSdzIFtleHRlbmRPd25dKGh0dHA6Ly91bmRlcnNjb3JlanMub3JnLyNleHRlbmRPd24pIG1ldGhvZDogTGlrZSB7QGxpbmsgV3JhcHBlciNleHRlbmR8ZXh0ZW5kfSwgYnV0IG9ubHkgY29waWVzIGl0cyBcIm93blwiIHByb3BlcnRpZXMgb3ZlciB0byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7Li4ub2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzb3VyY2UgLSBWYWx1ZXMgb2YgYG51bGxgIG9yIGB1bmRlZmluZWRgIGFyZSB0cmVhdGVkIGFzIGVtcHR5IHBsYWluIG9iamVjdHMuXG4gICAgICogQHJldHVybiB7V3JhcHBlcnxvYmplY3R9IFRoZSB3cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdCBpZiBjaGFpbmluZyBpcyBpbiBlZmZlY3Q7IG90aGVyd2lzZSB0aGUgdW53cmFwcGVkIGRlc3RpbmF0aW9uIG9iamVjdC5cbiAgICAgKiBAbWVtYmVyT2YgV3JhcHBlci5wcm90b3R5cGVcbiAgICAgKi9cbiAgICBleHRlbmRPd246IGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICAgICAgdmFyIG8gPSB0aGlzLm87XG4gICAgICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykuZm9yRWFjaChmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgICAgICAgICBXcmFwcGVyKG9iamVjdCkuZWFjaChmdW5jdGlvbiAodmFsLCBrZXkpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuZXctY2FwXG4gICAgICAgICAgICAgICAgb1trZXldID0gdmFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGFpbmluZyA/IHRoaXMgOiBvO1xuICAgIH1cbn07XG5cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0FycmF5L2ZpbmRcbmlmICghQXJyYXkucHJvdG90eXBlLmZpbmQpIHtcbiAgICBBcnJheS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChwcmVkaWNhdGUpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1leHRlbmQtbmF0aXZlXG4gICAgICAgIGlmICh0aGlzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcnJheS5wcm90b3R5cGUuZmluZCBjYWxsZWQgb24gbnVsbCBvciB1bmRlZmluZWQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHByZWRpY2F0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZGljYXRlIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBsaXN0ID0gT2JqZWN0KHRoaXMpO1xuICAgICAgICB2YXIgbGVuZ3RoID0gbGlzdC5sZW5ndGggPj4+IDA7XG4gICAgICAgIHZhciB0aGlzQXJnID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB2YXIgdmFsdWU7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFsdWUgPSBsaXN0W2ldO1xuICAgICAgICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpLCBsaXN0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gV3JhcHBlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqIEBtb2R1bGUgb3ZlcnJpZGVyICovXG5cbi8qKlxuICogTWl4ZXMgbWVtYmVycyBvZiBhbGwgYHNvdXJjZXNgIGludG8gYHRhcmdldGAsIGhhbmRsaW5nIGdldHRlcnMgYW5kIHNldHRlcnMgcHJvcGVybHkuXG4gKlxuICogQW55IG51bWJlciBvZiBgc291cmNlc2Agb2JqZWN0cyBtYXkgYmUgZ2l2ZW4gYW5kIGVhY2ggaXMgY29waWVkIGluIHR1cm4uXG4gKlxuICogQGV4YW1wbGVcbiAqIHZhciBvdmVycmlkZXIgPSByZXF1aXJlKCdvdmVycmlkZXInKTtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEgfSwgc291cmNlMSA9IHsgYjogMiB9LCBzb3VyY2UyID0geyBjOiAzIH07XG4gKiB0YXJnZXQgPT09IG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZTEsIHNvdXJjZTIpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYSwgYiwgYW5kIGM7IHNvdXJjZSBvYmplY3RzIHVudG91Y2hlZFxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBvYmplY3QgLSBUaGUgdGFyZ2V0IG9iamVjdCB0byByZWNlaXZlIHNvdXJjZXMuXG4gKiBAcGFyYW0gey4uLm9iamVjdH0gW3NvdXJjZXNdIC0gT2JqZWN0KHMpIGNvbnRhaW5pbmcgbWVtYmVycyB0byBjb3B5IHRvIGB0YXJnZXRgLiAoT21pdHRpbmcgaXMgYSBuby1vcC4pXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgdGFyZ2V0IG9iamVjdCAoYHRhcmdldGApXG4gKi9cbmZ1bmN0aW9uIG92ZXJyaWRlcih0YXJnZXQsIHNvdXJjZXMpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIG1peEluLmNhbGwodGFyZ2V0LCBhcmd1bWVudHNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbi8qKlxuICogTWl4IGB0aGlzYCBtZW1iZXJzIGludG8gYHRhcmdldGAuXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEEuIFNpbXBsZSB1c2FnZSAodXNpbmcgLmNhbGwpOlxuICogdmFyIG1peEluVG8gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJblRvO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluVG8uY2FsbChzb3VyY2UsIHRhcmdldCk7IC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSBzb3VyY2UgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW5UbyA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluVG87XG4gKiB2YXIgdGFyZ2V0ID0geyBhOiAxIH0sIHNvdXJjZSA9IHsgYjogMiwgbWl4SW5UbzogbWl4SW5UbyB9O1xuICogdGFyZ2V0ID09PSBzb3VyY2UubWl4SW5Ubyh0YXJnZXQpOyAvLyB0cnVlXG4gKiAvLyB0YXJnZXQgb2JqZWN0IG5vdyBoYXMgYm90aCBhIGFuZCBiOyBzb3VyY2Ugb2JqZWN0IHVudG91Y2hlZFxuICpcbiAqIEB0aGlzIHtvYmplY3R9IFRhcmdldC5cbiAqIEBwYXJhbSB0YXJnZXRcbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSB0YXJnZXQgb2JqZWN0IChgdGFyZ2V0YClcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluVG8odGFyZ2V0KSB7XG4gICAgdmFyIGRlc2NyaXB0b3I7XG4gICAgZm9yICh2YXIga2V5IGluIHRoaXMpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0aGlzLCBrZXkpKSkge1xuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xufVxuXG4vKipcbiAqIE1peCBgc291cmNlYCBtZW1iZXJzIGludG8gYHRoaXNgLlxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBBLiBTaW1wbGUgdXNhZ2UgKHVzaW5nIC5jYWxsKTpcbiAqIHZhciBtaXhJbiA9IHJlcXVpcmUoJ292ZXJyaWRlcicpLm1peEluO1xuICogdmFyIHRhcmdldCA9IHsgYTogMSB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gb3ZlcnJpZGVyLm1peEluLmNhbGwodGFyZ2V0LCBzb3VyY2UpIC8vIHRydWVcbiAqIC8vIHRhcmdldCBvYmplY3Qgbm93IGhhcyBib3RoIGEgYW5kIGI7IHNvdXJjZSBvYmplY3QgdW50b3VjaGVkXG4gKlxuICogQGV4YW1wbGVcbiAqIC8vIEIuIFNlbWFudGljIHVzYWdlICh3aGVuIHRoZSB0YXJnZXQgaG9zdHMgdGhlIG1ldGhvZCk6XG4gKiB2YXIgbWl4SW4gPSByZXF1aXJlKCdvdmVycmlkZXInKS5taXhJbjtcbiAqIHZhciB0YXJnZXQgPSB7IGE6IDEsIG1peEluOiBtaXhJbiB9LCBzb3VyY2UgPSB7IGI6IDIgfTtcbiAqIHRhcmdldCA9PT0gdGFyZ2V0Lm1peEluKHNvdXJjZSkgLy8gdHJ1ZVxuICogLy8gdGFyZ2V0IG5vdyBoYXMgYm90aCBhIGFuZCBiIChhbmQgbWl4SW4pOyBzb3VyY2UgdW50b3VjaGVkXG4gKlxuICogQHBhcmFtIHNvdXJjZVxuICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QgKGB0aGlzYClcbiAqIEBtZW1iZXJPZiBvdmVycmlkZXJcbiAqIEBtZW1iZXJPZiBtb2R1bGU6b3ZlcnJpZGVyXG4gKi9cbmZ1bmN0aW9uIG1peEluKHNvdXJjZSkge1xuICAgIHZhciBkZXNjcmlwdG9yO1xuICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgaWYgKChkZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihzb3VyY2UsIGtleSkpKSB7XG4gICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZXNjcmlwdG9yKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbn1cblxub3ZlcnJpZGVyLm1peEluVG8gPSBtaXhJblRvO1xub3ZlcnJpZGVyLm1peEluID0gbWl4SW47XG5cbm1vZHVsZS5leHBvcnRzID0gb3ZlcnJpZGVyO1xuIiwiLyogZXNsaW50LWVudiBicm93c2VyICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFJFR0VYUF9JTkRJUkVDVElPTiA9IC9eKFxcdyspXFwoKFxcdyspXFwpJC87ICAvLyBmaW5kcyBjb21wbGV0ZSBwYXR0ZXJuIGEoYikgd2hlcmUgYm90aCBhIGFuZCBiIGFyZSByZWdleCBcIndvcmRzXCJcblxuLyoqIEB0eXBlZGVmIHtvYmplY3R9IHZhbHVlSXRlbVxuICogWW91IHNob3VsZCBzdXBwbHkgYm90aCBgbmFtZWAgYW5kIGBhbGlhc2AgYnV0IHlvdSBjb3VsZCBvbWl0IG9uZSBvciB0aGUgb3RoZXIgYW5kIHdoaWNoZXZlciB5b3UgcHJvdmlkZSB3aWxsIGJlIHVzZWQgZm9yIGJvdGguXG4gKiA+IElmIHlvdSBvbmx5IGdpdmUgdGhlIGBuYW1lYCBwcm9wZXJ0eSwgeW91IG1pZ2h0IGFzIHdlbGwganVzdCBnaXZlIGEgc3RyaW5nIGZvciB7QGxpbmsgbWVudUl0ZW19IHJhdGhlciB0aGFuIHRoaXMgb2JqZWN0LlxuICogQHByb3BlcnR5IHtzdHJpbmd9IFtuYW1lPWFsaWFzXSAtIFZhbHVlIG9mIGB2YWx1ZWAgYXR0cmlidXRlIG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbYWxpYXM9bmFtZV0gLSBUZXh0IG9mIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgZWxlbWVudC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBbdHlwZV0gT25lIG9mIHRoZSBrZXlzIG9mIGB0aGlzLmNvbnZlcnRlcnNgLiBJZiBub3Qgb25lIG9mIHRoZXNlIChpbmNsdWRpbmcgYHVuZGVmaW5lZGApLCBmaWVsZCB2YWx1ZXMgd2lsbCBiZSB0ZXN0ZWQgd2l0aCBhIHN0cmluZyBjb21wYXJpc29uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBbaGlkZGVuPWZhbHNlXVxuICovXG5cbi8qKiBAdHlwZWRlZiB7b2JqZWN0fG1lbnVJdGVtW119IHN1Ym1lbnVJdGVtXG4gKiBAc3VtbWFyeSBIaWVyYXJjaGljYWwgYXJyYXkgb2Ygc2VsZWN0IGxpc3QgaXRlbXMuXG4gKiBAZGVzYyBEYXRhIHN0cnVjdHVyZSByZXByZXNlbnRpbmcgdGhlIGxpc3Qgb2YgYDxvcHRpb24+Li4uPC9vcHRpb24+YCBhbmQgYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMgdGhhdCBtYWtlIHVwIGEgYDxzZWxlY3Q+Li4uPC9zZWxlY3Q+YCBlbGVtZW50LlxuICpcbiAqID4gQWx0ZXJuYXRlIGZvcm06IEluc3RlYWQgb2YgYW4gb2JqZWN0IHdpdGggYSBgbWVudWAgcHJvcGVydHkgY29udGFpbmluZyBhbiBhcnJheSwgbWF5IGl0c2VsZiBiZSB0aGF0IGFycmF5LiBCb3RoIGZvcm1zIGhhdmUgdGhlIG9wdGlvbmFsIGBsYWJlbGAgcHJvcGVydHkuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gW2xhYmVsXSAtIERlZmF1bHRzIHRvIGEgZ2VuZXJhdGVkIHN0cmluZyBvZiB0aGUgZm9ybSBcIkdyb3VwIG5bLm1dLi4uXCIgd2hlcmUgZWFjaCBkZWNpbWFsIHBvc2l0aW9uIHJlcHJlc2VudHMgYSBsZXZlbCBvZiB0aGUgb3B0Z3JvdXAgaGllcmFyY2h5LlxuICogQHByb3BlcnR5IHttZW51SXRlbVtdfSBzdWJtZW51XG4gKi9cblxuLyoqIEB0eXBlZGVmIHtzdHJpbmd8dmFsdWVJdGVtfHN1Ym1lbnVJdGVtfSBtZW51SXRlbVxuICogTWF5IGJlIG9uZSBvZiB0aHJlZSBwb3NzaWJsZSB0eXBlcyB0aGF0IHNwZWNpZnkgZWl0aGVyIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgb3IgYW4gYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnQgYXMgZm9sbG93czpcbiAqICogSWYgYSBgc3RyaW5nYCwgc3BlY2lmaWVzIHRoZSB0ZXh0IG9mIGFuIGA8b3B0aW9uPi4uLi48L29wdGlvbj5gIGVsZW1lbnQgd2l0aCBubyBgdmFsdWVgIGF0dHJpYnV0ZS4gKEluIHRoZSBhYnNlbmNlIG9mIGEgYHZhbHVlYCBhdHRyaWJ1dGUsIHRoZSBgdmFsdWVgIHByb3BlcnR5IG9mIHRoZSBlbGVtZW50IGRlZmF1bHRzIHRvIHRoZSB0ZXh0LilcbiAqICogSWYgc2hhcGVkIGxpa2UgYSB7QGxpbmsgdmFsdWVJdGVtfSBvYmplY3QsIHNwZWNpZmllcyBib3RoIHRoZSB0ZXh0IGFuZCB2YWx1ZSBvZiBhbiBgPG9wdGlvbi4uLi48L29wdGlvbj5gIGVsZW1lbnQuXG4gKiAqIElmIHNoYXBlZCBsaWtlIGEge0BsaW5rIHN1Ym1lbnVJdGVtfSBvYmplY3QgKG9yIGl0cyBhbHRlcm5hdGUgYXJyYXkgZm9ybSksIHNwZWNpZmllcyBhbiBgPG9wdGdyb3VwPi4uLi48L29wdGdyb3VwPmAgZWxlbWVudC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IEJ1aWxkcyBhIG5ldyBtZW51IHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyBhbmQgZ3JvdXBzLlxuICogQGRlc2MgVGhpcyBmdW5jdGlvbiBjcmVhdGVzIGEgbmV3IHBvcC11cCBtZW51IChhLmsuYS4gXCJkcm9wLWRvd25cIikuIFRoaXMgaXMgYSBgPHNlbGVjdD4uLi48L3NlbGVjdD5gIGVsZW1lbnQsIHByZS1wb3B1bGF0ZWQgd2l0aCBpdGVtcyAoYDxvcHRpb24+Li4uPC9vcHRpb24+YCBlbGVtZW50cykgYW5kIGdyb3VwcyAoYDxvcHRncm91cD4uLi48L29wdGdyb3VwPmAgZWxlbWVudHMpLlxuICogPiBCb251czogVGhpcyBmdW5jdGlvbiBhbHNvIGJ1aWxkcyBgaW5wdXQgdHlwZT10ZXh0YCBlbGVtZW50cy5cbiAqID4gTk9URTogVGhpcyBmdW5jdGlvbiBnZW5lcmF0ZXMgT1BUR1JPVVAgZWxlbWVudHMgZm9yIHN1YnRyZWVzLiBIb3dldmVyLCBub3RlIHRoYXQgSFRNTDUgc3BlY2lmaWVzIHRoYXQgT1BUR1JPVVAgZWxlbW5lbnRzIG1hZGUgbm90IG5lc3QhIFRoaXMgZnVuY3Rpb24gZ2VuZXJhdGVzIHRoZSBtYXJrdXAgZm9yIHRoZW0gYnV0IHRoZXkgYXJlIG5vdCByZW5kZXJlZCBieSBtb3N0IGJyb3dzZXJzLCBvciBub3QgY29tcGxldGVseS4gVGhlcmVmb3JlLCBmb3Igbm93LCBkbyBub3Qgc3BlY2lmeSBtb3JlIHRoYW4gb25lIGxldmVsIHN1YnRyZWVzLiBGdXR1cmUgdmVyc2lvbnMgb2YgSFRNTCBtYXkgc3VwcG9ydCBpdC4gSSBhbHNvIHBsYW4gdG8gYWRkIGhlcmUgb3B0aW9ucyB0byBhdm9pZCBPUFRHUk9VUFMgZW50aXJlbHkgZWl0aGVyIGJ5IGluZGVudGluZyBvcHRpb24gdGV4dCwgb3IgYnkgY3JlYXRpbmcgYWx0ZXJuYXRlIERPTSBub2RlcyB1c2luZyBgPGxpPmAgaW5zdGVhZCBvZiBgPHNlbGVjdD5gLCBvciBib3RoLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR8c3RyaW5nfSBlbCAtIE11c3QgYmUgb25lIG9mIChjYXNlLXNlbnNpdGl2ZSk6XG4gKiAqIHRleHQgYm94IC0gYW4gYEhUTUxJbnB1dEVsZW1lbnRgIHRvIHVzZSBhbiBleGlzdGluZyBlbGVtZW50IG9yIGAnSU5QVVQnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIGRyb3AtZG93biAtIGFuIGBIVE1MU2VsZWN0RWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdTRUxFQ1QnYCB0byBjcmVhdGUgYSBuZXcgb25lXG4gKiAqIHN1Ym1lbnUgLSBhbiBgSFRNTE9wdEdyb3VwRWxlbWVudGAgdG8gdXNlIGFuIGV4aXN0aW5nIGVsZW1lbnQgb3IgYCdPUFRHUk9VUCdgIHRvIGNyZWF0ZSBhIG5ldyBvbmUgKG1lYW50IGZvciBpbnRlcm5hbCB1c2Ugb25seSlcbiAqXG4gKiBAcGFyYW0ge21lbnVJdGVtW119IFttZW51XSAtIEhpZXJhcmNoaWNhbCBsaXN0IG9mIHN0cmluZ3MgdG8gYWRkIGFzIGA8b3B0aW9uPi4uLjwvb3B0aW9uPmAgb3IgYDxvcHRncm91cD4uLi4uPC9vcHRncm91cD5gIGVsZW1lbnRzLiBPbWl0dGluZyBjcmVhdGVzIGEgdGV4dCBib3guXG4gKlxuICogQHBhcmFtIHtudWxsfHN0cmluZ30gW29wdGlvbnMucHJvbXB0PScnXSAtIEFkZHMgYW4gaW5pdGlhbCBgPG9wdGlvbj4uLi48L29wdGlvbj5gIGVsZW1lbnQgdG8gdGhlIGRyb3AtZG93biB3aXRoIHRoaXMgdmFsdWUgaW4gcGFyZW50aGVzZXMgYXMgaXRzIGB0ZXh0YDsgYW5kIGVtcHR5IHN0cmluZyBhcyBpdHMgYHZhbHVlYC4gRGVmYXVsdCBpcyBlbXB0eSBzdHJpbmcsIHdoaWNoIGNyZWF0ZXMgYSBibGFuayBwcm9tcHQ7IGBudWxsYCBzdXBwcmVzc2VzIHByb21wdCBhbHRvZ2V0aGVyLlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc29ydF0gLSBXaGV0aGVyIHRvIGFscGhhIHNvcnQgb3Igbm90LiBJZiB0cnV0aHksIHNvcnRzIGVhY2ggb3B0Z3JvdXAgb24gaXRzIGBsYWJlbGA7IGFuZCBlYWNoIHNlbGVjdCBvcHRpb24gb24gaXRzIHRleHQgKGl0cyBgYWxpYXNgIGlmIGdpdmVuOyBvciBpdHMgYG5hbWVgIGlmIG5vdCkuXG4gKlxuICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuYmxhY2tsaXN0XSAtIE9wdGlvbmFsIGxpc3Qgb2YgbWVudSBpdGVtIG5hbWVzIHRvIGJlIGlnbm9yZWQuXG4gKlxuICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuYnJlYWRjcnVtYnNdIC0gTGlzdCBvZiBvcHRpb24gZ3JvdXAgc2VjdGlvbiBudW1iZXJzIChyb290IGlzIHNlY3Rpb24gMCkuIChGb3IgaW50ZXJuYWwgdXNlLilcbiAqXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFwcGVuZD1mYWxzZV0gLSBXaGVuIGBlbGAgaXMgYW4gZXhpc3RpbmcgYDxzZWxlY3Q+YCBFbGVtZW50LCBnaXZpbmcgdHJ1dGh5IHZhbHVlIGFkZHMgdGhlIG5ldyBjaGlsZHJlbiB3aXRob3V0IGZpcnN0IHJlbW92aW5nIGV4aXN0aW5nIGNoaWxkcmVuLlxuICpcbiAqIEByZXR1cm5zIHtFbGVtZW50fSBFaXRoZXIgYSBgPHNlbGVjdD5gIG9yIGA8b3B0Z3JvdXA+YCBlbGVtZW50LlxuICovXG5mdW5jdGlvbiBidWlsZChlbCwgbWVudSwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIHByb21wdCA9IG9wdGlvbnMucHJvbXB0LFxuICAgICAgICBibGFja2xpc3QgPSBvcHRpb25zLmJsYWNrbGlzdCxcbiAgICAgICAgc29ydCA9IG9wdGlvbnMuc29ydCxcbiAgICAgICAgYnJlYWRjcnVtYnMgPSBvcHRpb25zLmJyZWFkY3J1bWJzIHx8IFtdLFxuICAgICAgICBwYXRoID0gYnJlYWRjcnVtYnMubGVuZ3RoID8gYnJlYWRjcnVtYnMuam9pbignLicpICsgJy4nIDogJycsXG4gICAgICAgIHN1YnRyZWVOYW1lID0gcG9wTWVudS5zdWJ0cmVlLFxuICAgICAgICBncm91cEluZGV4ID0gMCxcbiAgICAgICAgdGFnTmFtZTtcblxuICAgIGlmIChlbCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgdGFnTmFtZSA9IGVsLnRhZ05hbWU7XG4gICAgICAgIGlmICghb3B0aW9ucy5hcHBlbmQpIHtcbiAgICAgICAgICAgIGVsLmlubmVySFRNTCA9ICcnOyAvLyByZW1vdmUgYWxsIDxvcHRpb24+IGFuZCA8b3B0Z3JvdXA+IGVsZW1lbnRzXG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0YWdOYW1lID0gZWw7XG4gICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbiAgICB9XG5cbiAgICBpZiAobWVudSkge1xuICAgICAgICB2YXIgYWRkLCBuZXdPcHRpb247XG4gICAgICAgIGlmICh0YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICAgICAgYWRkID0gZWwuYWRkO1xuICAgICAgICAgICAgaWYgKHByb21wdCkge1xuICAgICAgICAgICAgICAgIG5ld09wdGlvbiA9IG5ldyBPcHRpb24ocHJvbXB0LCAnJyk7XG4gICAgICAgICAgICAgICAgbmV3T3B0aW9uLmlubmVySFRNTCArPSAnJmhlbGxpcDsnO1xuICAgICAgICAgICAgICAgIGVsLmFkZChuZXdPcHRpb24pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9tcHQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbC5hZGQobmV3IE9wdGlvbigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFkZCA9IGVsLmFwcGVuZENoaWxkO1xuICAgICAgICAgICAgZWwubGFiZWwgPSBwcm9tcHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc29ydCkge1xuICAgICAgICAgICAgbWVudSA9IG1lbnUuc2xpY2UoKS5zb3J0KGl0ZW1Db21wYXJhdG9yKTsgLy8gc29ydGVkIGNsb25lXG4gICAgICAgIH1cblxuICAgICAgICBtZW51LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgLy8gaWYgaXRlbSBpcyBvZiBmb3JtIGEoYikgYW5kIHRoZXJlIGlzIGFuIGZ1bmN0aW9uIGEgaW4gb3B0aW9ucywgdGhlbiBpdGVtID0gb3B0aW9ucy5hKGIpXG4gICAgICAgICAgICBpZiAob3B0aW9ucyAmJiB0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kaXJlY3Rpb24gPSBpdGVtLm1hdGNoKFJFR0VYUF9JTkRJUkVDVElPTik7XG4gICAgICAgICAgICAgICAgaWYgKGluZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBhID0gaW5kaXJlY3Rpb25bMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICBiID0gaW5kaXJlY3Rpb25bMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmID0gb3B0aW9uc1thXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0gZihiKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93ICdidWlsZDogRXhwZWN0ZWQgb3B0aW9ucy4nICsgYSArICcgdG8gYmUgYSBmdW5jdGlvbi4nO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICBpZiAoc3VidHJlZSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ3JvdXBPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBicmVhZGNydW1iczogYnJlYWRjcnVtYnMuY29uY2F0KCsrZ3JvdXBJbmRleCksXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogaXRlbS5sYWJlbCB8fCAnR3JvdXAgJyArIHBhdGggKyBncm91cEluZGV4LFxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zOiBzb3J0LFxuICAgICAgICAgICAgICAgICAgICBibGFja2xpc3Q6IGJsYWNrbGlzdFxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICB2YXIgb3B0Z3JvdXAgPSBidWlsZCgnT1BUR1JPVVAnLCBzdWJ0cmVlLCBncm91cE9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGdyb3VwLmNoaWxkRWxlbWVudENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLmFwcGVuZENoaWxkKG9wdGdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIShibGFja2xpc3QgJiYgYmxhY2tsaXN0LmluZGV4T2YoaXRlbSkgPj0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWRkLmNhbGwoZWwsIG5ldyBPcHRpb24oaXRlbSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5oaWRkZW4pIHtcblxuICAgICAgICAgICAgICAgIHZhciBuYW1lID0gaXRlbS5uYW1lIHx8IGl0ZW0uYWxpYXM7XG4gICAgICAgICAgICAgICAgaWYgKCEoYmxhY2tsaXN0ICYmIGJsYWNrbGlzdC5pbmRleE9mKG5hbWUpID49IDApKSB7XG4gICAgICAgICAgICAgICAgICAgIGFkZC5jYWxsKGVsLCBuZXcgT3B0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5hbGlhcyB8fCBpdGVtLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lXG4gICAgICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbC50eXBlID0gJ3RleHQnO1xuICAgIH1cblxuICAgIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gaXRlbUNvbXBhcmF0b3IoYSwgYikge1xuICAgIGEgPSBhLmFsaWFzIHx8IGEubmFtZSB8fCBhLmxhYmVsIHx8IGE7XG4gICAgYiA9IGIuYWxpYXMgfHwgYi5uYW1lIHx8IGIubGFiZWwgfHwgYjtcbiAgICByZXR1cm4gYSA8IGIgPyAtMSA6IGEgPiBiID8gMSA6IDA7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgUmVjdXJzaXZlbHkgc2VhcmNoZXMgdGhlIGNvbnRleHQgYXJyYXkgb2YgYG1lbnVJdGVtYHMgZm9yIGEgbmFtZWQgYGl0ZW1gLlxuICogQG1lbWJlck9mIHBvcE1lbnVcbiAqIEB0aGlzIEFycmF5XG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMua2V5cz1bcG9wTWVudS5kZWZhdWx0S2V5XV0gLSBQcm9wZXJ0aWVzIHRvIHNlYXJjaCBlYWNoIG1lbnVJdGVtIHdoZW4gaXQgaXMgYW4gb2JqZWN0LlxuICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYXNlU2Vuc2l0aXZlPWZhbHNlXSAtIElnbm9yZSBjYXNlIHdoaWxlIHNlYXJjaGluZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSAtIFZhbHVlIHRvIHNlYXJjaCBmb3IuXG4gKiBAcmV0dXJucyB7dW5kZWZpbmVkfG1lbnVJdGVtfSBUaGUgZm91bmQgaXRlbSBvciBgdW5kZWZpbmVkYCBpZiBub3QgZm91bmQuXG4gKi9cbmZ1bmN0aW9uIGxvb2t1cChvcHRpb25zLCB2YWx1ZSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHZhbHVlID0gb3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB2YXIgc2hhbGxvdywgZGVlcCwgaXRlbSwgcHJvcCxcbiAgICAgICAga2V5cyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5rZXlzIHx8IFtwb3BNZW51LmRlZmF1bHRLZXldLFxuICAgICAgICBjYXNlU2Vuc2l0aXZlID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhc2VTZW5zaXRpdmU7XG5cbiAgICB2YWx1ZSA9IHRvU3RyaW5nKHZhbHVlLCBjYXNlU2Vuc2l0aXZlKTtcblxuICAgIHNoYWxsb3cgPSB0aGlzLmZpbmQoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICB2YXIgc3VidHJlZSA9IGl0ZW1bcG9wTWVudS5zdWJ0cmVlXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmIChzdWJ0cmVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgIHJldHVybiAoZGVlcCA9IGxvb2t1cC5jYWxsKHN1YnRyZWUsIG9wdGlvbnMsIHZhbHVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGl0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gdG9TdHJpbmcoaXRlbSwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgcHJvcCA9IGl0ZW1ba2V5c1tpXV07XG4gICAgICAgICAgICAgICAgaWYgKHByb3AgJiYgdG9TdHJpbmcocHJvcCwgY2FzZVNlbnNpdGl2ZSkgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaXRlbSA9IGRlZXAgfHwgc2hhbGxvdztcblxuICAgIHJldHVybiBpdGVtICYmIChpdGVtLm5hbWUgPyBpdGVtIDogeyBuYW1lOiBpdGVtIH0pO1xufVxuXG5mdW5jdGlvbiB0b1N0cmluZyhzLCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIGlmIChzKSB7XG4gICAgICAgIHJlc3VsdCArPSBzOyAvLyBjb252ZXJ0IHMgdG8gc3RyaW5nXG4gICAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnRvVXBwZXJDYXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBSZWN1cnNpdmVseSB3YWxrcyB0aGUgY29udGV4dCBhcnJheSBvZiBgbWVudUl0ZW1gcyBhbmQgY2FsbHMgYGl0ZXJhdGVlYCBvbiBlYWNoIGl0ZW0gdGhlcmVpbi5cbiAqIEBkZXNjIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGggZWFjaCBpdGVtICh0ZXJtaW5hbCBub2RlKSBpbiB0aGUgbWVudSB0cmVlIGFuZCBhIGZsYXQgMC1iYXNlZCBpbmRleC4gUmVjdXJzZXMgb24gbWVtYmVyIHdpdGggbmFtZSBvZiBgcG9wTWVudS5zdWJ0cmVlYC5cbiAqXG4gKiBUaGUgbm9kZSB3aWxsIGFsd2F5cyBiZSBhIHtAbGluayB2YWx1ZUl0ZW19IG9iamVjdDsgd2hlbiBhIGBzdHJpbmdgLCBpdCBpcyBib3hlZCBmb3IgeW91LlxuICpcbiAqIEBtZW1iZXJPZiBwb3BNZW51XG4gKlxuICogQHRoaXMgQXJyYXlcbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBpdGVyYXRlZSAtIEZvciBlYWNoIGl0ZW0gaW4gdGhlIG1lbnUsIGBpdGVyYXRlZWAgaXMgY2FsbGVkIHdpdGg6XG4gKiAqIHRoZSBgdmFsdWVJdGVtYCAoaWYgdGhlIGl0ZW0gaXMgYSBwcmltYXRpdmUgc3RyaW5nLCBpdCBpcyB3cmFwcGVkIHVwIGZvciB5b3UpXG4gKiAqIGEgMC1iYXNlZCBgb3JkaW5hbGBcbiAqXG4gKiBUaGUgYGl0ZXJhdGVlYCByZXR1cm4gdmFsdWUgY2FuIGJlIHVzZWQgdG8gcmVwbGFjZSB0aGUgaXRlbSwgYXMgZm9sbG93czpcbiAqICogYHVuZGVmaW5lZGAgLSBkbyBub3RoaW5nXG4gKiAqIGBudWxsYCAtIHNwbGljZSBvdXQgdGhlIGl0ZW07IHJlc3VsdGluZyBlbXB0eSBzdWJtZW51cyBhcmUgYWxzbyBzcGxpY2VkIG91dCAoc2VlIG5vdGUpXG4gKiAqIGFueXRoaW5nIGVsc2UgLSByZXBsYWNlIHRoZSBpdGVtIHdpdGggdGhpcyB2YWx1ZTsgaWYgdmFsdWUgaXMgYSBzdWJ0cmVlIChpLmUuLCBhbiBhcnJheSkgYGl0ZXJhdGVlYCB3aWxsIHRoZW4gYmUgY2FsbGVkIHRvIHdhbGsgaXQgYXMgd2VsbCAoc2VlIG5vdGUpXG4gKlxuICogPiBOb3RlOiBSZXR1cm5pbmcgYW55dGhpbmcgKG90aGVyIHRoYW4gYHVuZGVmaW5lZGApIGZyb20gYGl0ZXJhdGVlYCB3aWxsIChkZWVwbHkpIG11dGF0ZSB0aGUgb3JpZ2luYWwgYG1lbnVgIHNvIHlvdSBtYXkgd2FudCB0byBjb3B5IGl0IGZpcnN0IChkZWVwbHksIGluY2x1ZGluZyBhbGwgbGV2ZWxzIG9mIGFycmF5IG5lc3RpbmcgYnV0IG5vdCB0aGUgdGVybWluYWwgbm9kZSBvYmplY3RzKS5cbiAqXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBOdW1iZXIgb2YgaXRlbXMgKHRlcm1pbmFsIG5vZGVzKSBpbiB0aGUgbWVudSB0cmVlLlxuICovXG5mdW5jdGlvbiB3YWxrKGl0ZXJhdGVlKSB7XG4gICAgdmFyIG1lbnUgPSB0aGlzLFxuICAgICAgICBvcmRpbmFsID0gMCxcbiAgICAgICAgc3VidHJlZU5hbWUgPSBwb3BNZW51LnN1YnRyZWUsXG4gICAgICAgIGksIGl0ZW0sIHN1YnRyZWUsIG5ld1ZhbDtcblxuICAgIGZvciAoaSA9IG1lbnUubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgaXRlbSA9IG1lbnVbaV07XG4gICAgICAgIHN1YnRyZWUgPSBpdGVtW3N1YnRyZWVOYW1lXSB8fCBpdGVtO1xuXG4gICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXN1YnRyZWUpIHtcbiAgICAgICAgICAgIG5ld1ZhbCA9IGl0ZXJhdGVlKGl0ZW0ubmFtZSA/IGl0ZW0gOiB7IG5hbWU6IGl0ZW0gfSwgb3JkaW5hbCk7XG4gICAgICAgICAgICBvcmRpbmFsICs9IDE7XG5cbiAgICAgICAgICAgIGlmIChuZXdWYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWwgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgIG9yZGluYWwgLT0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW51W2ldID0gaXRlbSA9IG5ld1ZhbDtcbiAgICAgICAgICAgICAgICAgICAgc3VidHJlZSA9IGl0ZW1bc3VidHJlZU5hbWVdIHx8IGl0ZW07XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHN1YnRyZWUgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YnRyZWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VidHJlZSkge1xuICAgICAgICAgICAgb3JkaW5hbCArPSB3YWxrLmNhbGwoc3VidHJlZSwgaXRlcmF0ZWUpO1xuICAgICAgICAgICAgaWYgKHN1YnRyZWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbWVudS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgb3JkaW5hbCAtPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yZGluYWw7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgRm9ybWF0IGl0ZW0gbmFtZSB3aXRoIGl0J3MgYWxpYXMgd2hlbiBhdmFpbGFibGUuXG4gKiBAbWVtYmVyT2YgcG9wTWVudVxuICogQHBhcmFtIHtzdHJpbmd8dmFsdWVJdGVtfSBpdGVtXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIG5hbWUgYW5kIGFsaWFzLlxuICovXG5mdW5jdGlvbiBmb3JtYXRJdGVtKGl0ZW0pIHtcbiAgICB2YXIgcmVzdWx0ID0gaXRlbS5uYW1lIHx8IGl0ZW07XG4gICAgaWYgKGl0ZW0uYWxpYXMpIHtcbiAgICAgICAgcmVzdWx0ID0gJ1wiJyArIGl0ZW0uYWxpYXMgKyAnXCIgKCcgKyByZXN1bHQgKyAnKSc7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuZnVuY3Rpb24gaXNHcm91cFByb3h5KHMpIHtcbiAgICByZXR1cm4gUkVHRVhQX0lORElSRUNUSU9OLnRlc3Qocyk7XG59XG5cbi8qKlxuICogQG5hbWVzcGFjZVxuICovXG52YXIgcG9wTWVudSA9IHtcbiAgICBidWlsZDogYnVpbGQsXG4gICAgd2Fsazogd2FsayxcbiAgICBsb29rdXA6IGxvb2t1cCxcbiAgICBmb3JtYXRJdGVtOiBmb3JtYXRJdGVtLFxuICAgIGlzR3JvdXBQcm94eTogaXNHcm91cFByb3h5LFxuICAgIHN1YnRyZWU6ICdzdWJtZW51JyxcbiAgICBkZWZhdWx0S2V5OiAnbmFtZSdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcG9wTWVudTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIC8vIGEgcmVnZXggc2VhcmNoIHBhdHRlcm4gdGhhdCBtYXRjaGVzIGFsbCB0aGUgcmVzZXJ2ZWQgY2hhcnMgb2YgYSByZWdleCBzZWFyY2ggcGF0dGVyblxuICAgIHJlc2VydmVkID0gLyhbXFwuXFxcXFxcK1xcKlxcP1xcXlxcJFxcKFxcKVxce1xcfVxcPVxcIVxcPFxcPlxcfFxcOlxcW1xcXV0pL2csXG5cbiAgICAvLyByZWdleCB3aWxkY2FyZCBzZWFyY2ggcGF0dGVybnNcbiAgICBSRUdFWFBfV0lMRENBUkQgPSAnLionLFxuICAgIFJFR0VYUF9XSUxEQ0hBUiA9ICcuJyxcbiAgICBSRUdFWFBfV0lMRENBUkRfTUFUQ0hFUiA9ICcoJyArIFJFR0VYUF9XSUxEQ0FSRCArICcpJyxcblxuICAgIC8vIExJS0Ugc2VhcmNoIHBhdHRlcm5zXG4gICAgTElLRV9XSUxEQ0hBUiA9ICdfJyxcbiAgICBMSUtFX1dJTERDQVJEID0gJyUnLFxuXG4gICAgLy8gcmVnZXggc2VhcmNoIHBhdHRlcm5zIHRoYXQgbWF0Y2ggTElLRSBzZWFyY2ggcGF0dGVybnNcbiAgICBSRUdFWFBfTElLRV9QQVRURVJOX01BVENIRVIgPSBuZXcgUmVnRXhwKCcoJyArIFtcbiAgICAgICAgTElLRV9XSUxEQ0hBUixcbiAgICAgICAgTElLRV9XSUxEQ0FSRCxcbiAgICAgICAgJ1xcXFxbXFxcXF4/W14tXFxcXF1dK10nLCAvLyBtYXRjaGVzIGEgTElLRSBzZXQgKHNhbWUgc3ludGF4IGFzIGEgUmVnRXhwIHNldClcbiAgICAgICAgJ1xcXFxbXFxcXF4/W14tXFxcXF1dXFxcXC1bXlxcXFxdXV0nIC8vIG1hdGNoZXMgYSBMSUtFIHJhbmdlIChzYW1lIHN5bnRheCBhcyBhIFJlZ0V4cCByYW5nZSlcbiAgICBdLmpvaW4oJ3wnKSArICcpJywgJ2cnKTtcblxuZnVuY3Rpb24gcmVnRXhwTElLRShwYXR0ZXJuLCBpZ25vcmVDYXNlKSB7XG4gICAgdmFyIGksIHBhcnRzO1xuXG4gICAgLy8gRmluZCBhbGwgTElLRSBwYXR0ZXJuc1xuICAgIHBhcnRzID0gcGF0dGVybi5tYXRjaChSRUdFWFBfTElLRV9QQVRURVJOX01BVENIRVIpO1xuXG4gICAgaWYgKHBhcnRzKSB7XG4gICAgICAgIC8vIFRyYW5zbGF0ZSBmb3VuZCBMSUtFIHBhdHRlcm5zIHRvIHJlZ2V4IHBhdHRlcm5zLCBlc2NhcGVkIGludGVydmVuaW5nIG5vbi1wYXR0ZXJucywgYW5kIGludGVybGVhdmUgdGhlIHR3b1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgLy8gRXNjYXBlIGxlZnQgYnJhY2tldHMgKHVucGFpcmVkIHJpZ2h0IGJyYWNrZXRzIGFyZSBPSylcbiAgICAgICAgICAgIGlmIChwYXJ0c1tpXVswXSA9PT0gJ1snKSB7XG4gICAgICAgICAgICAgICAgcGFydHNbaV0gPSByZWdFeHBMSUtFLnJlc2VydmUocGFydHNbaV0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIGVhY2ggZm91bmQgcGF0dGVybiBtYXRjaGFibGUgYnkgZW5jbG9zaW5nIGluIHBhcmVudGhlc2VzXG4gICAgICAgICAgICBwYXJ0c1tpXSA9ICcoJyArIHBhcnRzW2ldICsgJyknO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWF0Y2ggdGhlc2UgcHJlY2lzZSBwYXR0ZXJucyBhZ2FpbiB3aXRoIHRoZWlyIGludGVydmVuaW5nIG5vbi1wYXR0ZXJucyAoaS5lLiwgdGV4dClcbiAgICAgICAgcGFydHMgPSBwYXR0ZXJuLm1hdGNoKG5ldyBSZWdFeHAoXG4gICAgICAgICAgICBSRUdFWFBfV0lMRENBUkRfTUFUQ0hFUiArXG4gICAgICAgICAgICBwYXJ0cy5qb2luKFJFR0VYUF9XSUxEQ0FSRF9NQVRDSEVSKSAgK1xuICAgICAgICAgICAgUkVHRVhQX1dJTERDQVJEX01BVENIRVJcbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gRGlzY2FyZCBmaXJzdCBtYXRjaCBvZiBub24tZ2xvYmFsIHNlYXJjaCAod2hpY2ggaXMgdGhlIHdob2xlIHN0cmluZylcbiAgICAgICAgcGFydHMuc2hpZnQoKTtcblxuICAgICAgICAvLyBGb3IgZWFjaCByZS1mb3VuZCBwYXR0ZXJuIHBhcnQsIHRyYW5zbGF0ZSAlIGFuZCBfIHRvIHJlZ2V4IGVxdWl2YWxlbnRcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IHBhcnRzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgICAgICB2YXIgcGFydCA9IHBhcnRzW2ldO1xuICAgICAgICAgICAgc3dpdGNoIChwYXJ0KSB7XG4gICAgICAgICAgICAgICAgY2FzZSBMSUtFX1dJTERDQVJEOiBwYXJ0ID0gUkVHRVhQX1dJTERDQVJEOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIExJS0VfV0lMRENIQVI6IHBhcnQgPSBSRUdFWFBfV0lMRENIQVI7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHZhciBqID0gcGFydFsxXSA9PT0gJ14nID8gMiA6IDE7XG4gICAgICAgICAgICAgICAgICAgIHBhcnQgPSAnWycgKyByZWdFeHBMSUtFLnJlc2VydmUocGFydC5zdWJzdHIoaiwgcGFydC5sZW5ndGggLSAoaiArIDEpKSkgKyAnXSc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJ0c1tpXSA9IHBhcnQ7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXJ0cyA9IFtwYXR0ZXJuXTtcbiAgICB9XG5cbiAgICAvLyBGb3IgZWFjaCBzdXJyb3VuZGluZyB0ZXh0IHBhcnQsIGVzY2FwZSByZXNlcnZlZCByZWdleCBjaGFyc1xuICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkgKz0gMikge1xuICAgICAgICBwYXJ0c1tpXSA9IHJlZ0V4cExJS0UucmVzZXJ2ZShwYXJ0c1tpXSk7XG4gICAgfVxuXG4gICAgLy8gSm9pbiBhbGwgdGhlIGludGVybGVhdmVkIHBhcnRzXG4gICAgcGFydHMgPSBwYXJ0cy5qb2luKCcnKTtcblxuICAgIC8vIE9wdGltaXplIG9yIGFuY2hvciB0aGUgcGF0dGVybiBhdCBlYWNoIGVuZCBhcyBuZWVkZWRcbiAgICBpZiAocGFydHMuc3Vic3RyKDAsIDIpID09PSBSRUdFWFBfV0lMRENBUkQpIHsgcGFydHMgPSBwYXJ0cy5zdWJzdHIoMik7IH0gZWxzZSB7IHBhcnRzID0gJ14nICsgcGFydHM7IH1cbiAgICBpZiAocGFydHMuc3Vic3RyKC0yLCAyKSA9PT0gUkVHRVhQX1dJTERDQVJEKSB7IHBhcnRzID0gcGFydHMuc3Vic3RyKDAsIHBhcnRzLmxlbmd0aCAtIDIpOyB9IGVsc2UgeyBwYXJ0cyArPSAnJCc7IH1cblxuICAgIC8vIFJldHVybiB0aGUgbmV3IHJlZ2V4XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAocGFydHMsIGlnbm9yZUNhc2UgPyAnaScgOiB1bmRlZmluZWQpO1xufVxuXG5yZWdFeHBMSUtFLnJlc2VydmUgPSBmdW5jdGlvbiAocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UocmVzZXJ2ZWQsICdcXFxcJDEnKTtcbn07XG5cbnZhciBjYWNoZSwgc2l6ZTtcblxuLyoqXG4gKiBAc3VtbWFyeSBEZWxldGUgYSBwYXR0ZXJuIGZyb20gdGhlIGNhY2hlOyBvciBjbGVhciB0aGUgd2hvbGUgY2FjaGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gW3BhdHRlcm5dIC0gVGhlIExJS0UgcGF0dGVybiB0byByZW1vdmUgZnJvbSB0aGUgY2FjaGUuIEZhaWxzIHNpbGVudGx5IGlmIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUuIElmIHBhdHRlcm4gb21pdHRlZCwgY2xlYXJzIHdob2xlIGNhY2hlLlxuICovXG4ocmVnRXhwTElLRS5jbGVhckNhY2hlID0gZnVuY3Rpb24gKHBhdHRlcm4pIHtcbiAgICBpZiAoIXBhdHRlcm4pIHtcbiAgICAgICAgY2FjaGUgPSB7fTtcbiAgICAgICAgc2l6ZSA9IDA7XG4gICAgfSBlbHNlIGlmIChjYWNoZVtwYXR0ZXJuXSkge1xuICAgICAgICBkZWxldGUgY2FjaGVbcGF0dGVybl07XG4gICAgICAgIHNpemUtLTtcbiAgICB9XG4gICAgcmV0dXJuIHNpemU7XG59KSgpOyAvLyBpbml0IHRoZSBjYWNoZVxuXG5yZWdFeHBMSUtFLmdldENhY2hlU2l6ZSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpemU7IH07XG5cbi8qKlxuICogQHN1bW1hcnkgQ2FjaGVkIHZlcnNpb24gb2YgYHJlZ0V4cExJS0UoKWAuXG4gKiBAZGVzYyBDYWNoZWQgZW50cmllcyBhcmUgc3ViamVjdCB0byBnYXJiYWdlIGNvbGxlY3Rpb24gaWYgYGtlZXBgIGlzIGB1bmRlZmluZWRgIG9yIGBmYWxzZWAgb24gaW5zZXJ0aW9uIG9yIGBmYWxzZWAgb24gbW9zdCByZWNlbnQgcmVmZXJlbmNlLiBHYXJiYWdlIGNvbGxlY3Rpb24gd2lsbCBvY2N1ciBpZmYgYHJlZ0V4cExJS0UuY2FjaGVNYXhgIGlzIGRlZmluZWQgYW5kIGl0IGVxdWFscyB0aGUgbnVtYmVyIG9mIGNhY2hlZCBwYXR0ZXJucy4gVGhlIGdhcmJhZ2UgY29sbGVjdG9yIHNvcnRzIHRoZSBwYXR0ZXJucyBiYXNlZCBvbiBtb3N0IHJlY2VudCByZWZlcmVuY2U7IHRoZSBvbGRlc3QgMTAlIG9mIHRoZSBlbnRyaWVzIGFyZSBkZWxldGVkLiBBbHRlcm5hdGl2ZWx5LCB5b3UgY2FuIG1hbmFnZSB0aGUgY2FjaGUgeW91cnNlbGYgdG8gYSBsaW1pdGVkIGV4dGVudCAoc2VlIHtAbGluayByZWdlRXhwTElLRS5jbGVhckNhY2hlfGNsZWFyQ2FjaGV9KS5cbiAqIEBwYXJhbSBwYXR0ZXJuIC0gdGhlIExJS0UgcGF0dGVybiAodG8gYmUpIGNvbnZlcnRlZCB0byBhIFJlZ0V4cFxuICogQHBhcmFtIFtrZWVwXSAtIElmIGdpdmVuLCBjaGFuZ2VzIHRoZSBrZWVwIHN0YXR1cyBmb3IgdGhpcyBwYXR0ZXJuIGFzIGZvbGxvd3M6XG4gKiAqIGB0cnVlYCBwZXJtYW5lbnRseSBjYWNoZXMgdGhlIHBhdHRlcm4gKG5vdCBzdWJqZWN0IHRvIGdhcmJhZ2UgY29sbGVjdGlvbikgdW50aWwgYGZhbHNlYCBpcyBnaXZlbiBvbiBhIHN1YnNlcXVlbnQgY2FsbFxuICogKiBgZmFsc2VgIGFsbG93cyBnYXJiYWdlIGNvbGxlY3Rpb24gb24gdGhlIGNhY2hlZCBwYXR0ZXJuXG4gKiAqIGB1bmRlZmluZWRgIG5vIGNoYW5nZSB0byBrZWVwIHN0YXR1c1xuICogQHJldHVybnMge1JlZ0V4cH1cbiAqL1xucmVnRXhwTElLRS5jYWNoZWQgPSBmdW5jdGlvbiAoa2VlcCwgcGF0dGVybiwgaWdub3JlQ2FzZSkge1xuICAgIGlmICh0eXBlb2Yga2VlcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWdub3JlQ2FzZSA9IHBhdHRlcm47XG4gICAgICAgIHBhdHRlcm4gPSBrZWVwO1xuICAgICAgICBrZWVwID0gZmFsc2U7XG4gICAgfVxuICAgIHZhciBwYXR0ZXJuQW5kQ2FzZSA9IHBhdHRlcm4gKyAoaWdub3JlQ2FzZSA/ICdpJyA6ICdjJyksXG4gICAgICAgIGl0ZW0gPSBjYWNoZVtwYXR0ZXJuQW5kQ2FzZV07XG4gICAgaWYgKGl0ZW0pIHtcbiAgICAgICAgaXRlbS53aGVuID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIGlmIChrZWVwICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGl0ZW0ua2VlcCA9IGtlZXA7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc2l6ZSA9PT0gcmVnRXhwTElLRS5jYWNoZU1heCkge1xuICAgICAgICAgICAgdmFyIGFnZSA9IFtdLCBhZ2VzID0gMCwga2V5LCBpO1xuICAgICAgICAgICAgZm9yIChrZXkgaW4gY2FjaGUpIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gY2FjaGVba2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW0ua2VlcCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYWdlczsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXRlbS53aGVuIDwgYWdlW2ldLml0ZW0ud2hlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFnZS5zcGxpY2UoaSwgMCwgeyBrZXk6IGtleSwgaXRlbTogaXRlbSB9KTtcbiAgICAgICAgICAgICAgICAgICAgYWdlcysrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghYWdlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWdFeHBMSUtFKHBhdHRlcm4sIGlnbm9yZUNhc2UpOyAvLyBjYWNoZSBpcyBmdWxsIVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSA9IE1hdGguY2VpbChhZ2UubGVuZ3RoIC8gMTApOyAvLyB3aWxsIGFsd2F5cyBiZSBhdCBsZWFzdCAxXG4gICAgICAgICAgICBzaXplIC09IGk7XG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIGNhY2hlW2FnZVtpXS5rZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGl0ZW0gPSBjYWNoZVtwYXR0ZXJuQW5kQ2FzZV0gPSB7XG4gICAgICAgICAgICByZWdleDogcmVnRXhwTElLRShwYXR0ZXJuLCBpZ25vcmVDYXNlKSxcbiAgICAgICAgICAgIGtlZXA6IGtlZXAsXG4gICAgICAgICAgICB3aGVuOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICB9O1xuICAgICAgICBzaXplKys7XG4gICAgfVxuICAgIHJldHVybiBpdGVtLnJlZ2V4O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWdFeHBMSUtFO1xuIiwiLy8gdGVtcGxleCBub2RlIG1vZHVsZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2pvbmVpdC90ZW1wbGV4XG5cbi8qIGVzbGludC1lbnYgbm9kZSAqL1xuXG4vKipcbiAqIE1lcmdlcyB2YWx1ZXMgb2YgZXhlY3V0aW9uIGNvbnRleHQgcHJvcGVydGllcyBuYW1lZCBpbiB0ZW1wbGF0ZSBieSB7cHJvcDF9LFxuICoge3Byb3AyfSwgZXRjLiwgb3IgYW55IGphdmFzY3JpcHQgZXhwcmVzc2lvbiBpbmNvcnBvcmF0aW5nIHN1Y2ggcHJvcCBuYW1lcy5cbiAqIFRoZSBjb250ZXh0IGFsd2F5cyBpbmNsdWRlcyB0aGUgZ2xvYmFsIG9iamVjdC4gSW4gYWRkaXRpb24geW91IGNhbiBzcGVjaWZ5IGEgc2luZ2xlXG4gKiBjb250ZXh0IG9yIGFuIGFycmF5IG9mIGNvbnRleHRzIHRvIHNlYXJjaCAoaW4gdGhlIG9yZGVyIGdpdmVuKSBiZWZvcmUgZmluYWxseVxuICogc2VhcmNoaW5nIHRoZSBnbG9iYWwgY29udGV4dC5cbiAqXG4gKiBNZXJnZSBleHByZXNzaW9ucyBjb25zaXN0aW5nIG9mIHNpbXBsZSBudW1lcmljIHRlcm1zLCBzdWNoIGFzIHswfSwgezF9LCBldGMuLCBkZXJlZlxuICogdGhlIGZpcnN0IGNvbnRleHQgZ2l2ZW4sIHdoaWNoIGlzIGFzc3VtZWQgdG8gYmUgYW4gYXJyYXkuIEFzIGEgY29udmVuaWVuY2UgZmVhdHVyZSxcbiAqIGlmIGFkZGl0aW9uYWwgYXJncyBhcmUgZ2l2ZW4gYWZ0ZXIgYHRlbXBsYXRlYCwgYGFyZ3VtZW50c2AgaXMgdW5zaGlmdGVkIG9udG8gdGhlIGNvbnRleHRcbiAqIGFycmF5LCB0aHVzIG1ha2luZyBmaXJzdCBhZGRpdGlvbmFsIGFyZyBhdmFpbGFibGUgYXMgezF9LCBzZWNvbmQgYXMgezJ9LCBldGMuLCBhcyBpblxuICogYHRlbXBsZXgoJ0hlbGxvLCB7MX0hJywgJ1dvcmxkJylgLiAoezB9IGlzIHRoZSB0ZW1wbGF0ZSBzbyBjb25zaWRlciB0aGlzIHRvIGJlIDEtYmFzZWQuKVxuICpcbiAqIElmIHlvdSBwcmVmZXIgc29tZXRoaW5nIG90aGVyIHRoYW4gYnJhY2VzLCByZWRlZmluZSBgdGVtcGxleC5yZWdleHBgLlxuICpcbiAqIFNlZSB0ZXN0cyBmb3IgZXhhbXBsZXMuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlXG4gKiBAcGFyYW0gey4uLnN0cmluZ30gW2FyZ3NdXG4gKi9cbmZ1bmN0aW9uIHRlbXBsZXgodGVtcGxhdGUpIHtcbiAgICB2YXIgY29udGV4dHMgPSB0aGlzIGluc3RhbmNlb2YgQXJyYXkgPyB0aGlzIDogW3RoaXNdO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgeyBjb250ZXh0cy51bnNoaWZ0KGFyZ3VtZW50cyk7IH1cbiAgICByZXR1cm4gdGVtcGxhdGUucmVwbGFjZSh0ZW1wbGV4LnJlZ2V4cCwgdGVtcGxleC5tZXJnZXIuYmluZChjb250ZXh0cykpO1xufVxuXG50ZW1wbGV4LnJlZ2V4cCA9IC9cXHsoLio/KVxcfS9nO1xuXG50ZW1wbGV4LndpdGggPSBmdW5jdGlvbiAoaSwgcykge1xuICAgIHJldHVybiAnd2l0aCh0aGlzWycgKyBpICsgJ10peycgKyBzICsgJ30nO1xufTtcblxudGVtcGxleC5jYWNoZSA9IFtdO1xuXG50ZW1wbGV4LmRlcmVmID0gZnVuY3Rpb24gKGtleSkge1xuICAgIGlmICghKHRoaXMubGVuZ3RoIGluIHRlbXBsZXguY2FjaGUpKSB7XG4gICAgICAgIHZhciBjb2RlID0gJ3JldHVybiBldmFsKGV4cHIpJztcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvZGUgPSB0ZW1wbGV4LndpdGgoaSwgY29kZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wbGV4LmNhY2hlW3RoaXMubGVuZ3RoXSA9IGV2YWwoJyhmdW5jdGlvbihleHByKXsnICsgY29kZSArICd9KScpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV2YWxcbiAgICB9XG4gICAgcmV0dXJuIHRlbXBsZXguY2FjaGVbdGhpcy5sZW5ndGhdLmNhbGwodGhpcywga2V5KTtcbn07XG5cbnRlbXBsZXgubWVyZ2VyID0gZnVuY3Rpb24gKG1hdGNoLCBrZXkpIHtcbiAgICAvLyBBZHZhbmNlZCBmZWF0dXJlczogQ29udGV4dCBjYW4gYmUgYSBsaXN0IG9mIGNvbnRleHRzIHdoaWNoIGFyZSBzZWFyY2hlZCBpbiBvcmRlci5cbiAgICB2YXIgcmVwbGFjZW1lbnQ7XG5cbiAgICB0cnkge1xuICAgICAgICByZXBsYWNlbWVudCA9IGlzTmFOKGtleSkgPyB0ZW1wbGV4LmRlcmVmLmNhbGwodGhpcywga2V5KSA6IHRoaXNbMF1ba2V5XTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJlcGxhY2VtZW50ID0gJ3snICsga2V5ICsgJ30nO1xuICAgIH1cblxuICAgIHJldHVybiByZXBsYWNlbWVudDtcbn07XG5cbi8vIHRoaXMgaW50ZXJmYWNlIGNvbnNpc3RzIHNvbGVseSBvZiB0aGUgdGVtcGxleCBmdW5jdGlvbiAoYW5kIGl0J3MgcHJvcGVydGllcylcbm1vZHVsZS5leHBvcnRzID0gdGVtcGxleDtcbiIsIi8vIENyZWF0ZWQgYnkgSm9uYXRoYW4gRWl0ZW4gb24gMS83LzE2LlxuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVmVyeSBmYXN0IGFycmF5IHRlc3QuXG4gKiBGb3IgY3Jvc3MtZnJhbWUgc2NyaXB0aW5nOyB1c2UgYGNyb3NzRnJhbWVzSXNBcnJheWAgaW5zdGVhZC5cbiAqIEBwYXJhbSB7Kn0gYXJyIC0gVGhlIG9iamVjdCB0byB0ZXN0LlxuICogQHJldHVybnMge2Jvb2xlYW59XG4gKi9cbnVuc3RydW5naWZ5LmlzQXJyYXkgPSBmdW5jdGlvbihhcnIpIHsgcmV0dXJuIGFyci5jb25zdHJ1Y3RvciA9PT0gQXJyYXk7IH07XG5cbi8qKlxuICogQHN1bW1hcnkgV2FsayBhIGhpZXJhcmNoaWNhbCBvYmplY3QgYXMgSlNPTi5zdHJpbmdpZnkgZG9lcyBidXQgd2l0aG91dCBzZXJpYWxpemluZy5cbiAqXG4gKiBAZGVzYyBVc2FnZTpcbiAqICogdmFyIG15RGlzdGlsbGVkT2JqZWN0ID0gdW5zdHJ1bmdpZnkuY2FsbChteU9iamVjdCk7XG4gKiAqIHZhciBteURpc3RpbGxlZE9iamVjdCA9IG15QXBpLmdldFN0YXRlKCk7IC8vIHdoZXJlIG15QXBpLnByb3RvdHlwZS5nZXRTdGF0ZSA9IHVuc3RydW5naWZ5XG4gKlxuICogUmVzdWx0IGVxdWl2YWxlbnQgdG8gYEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcykpYC5cbiAqXG4gKiA+IERvIG5vdCB1c2UgdGhpcyBmdW5jdGlvbiB0byBnZXQgYSBKU09OIHN0cmluZzsgdXNlIGBKU09OLnN0cmluZ2lmeSh0aGlzKWAgaW5zdGVhZC5cbiAqXG4gKiBAdGhpcyB7KnxvYmplY3R8KltdfSAtIE9iamVjdCB0byB3YWxrOyB0eXBpY2FsbHkgYW4gb2JqZWN0IG9yIGFycmF5LlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubnVsbEVsZW1lbnRzPT1mYWxzZV0gLSBQcmVzZXJ2ZSB1bmRlZmluZWQgYXJyYXkgZWxlbWVudHMgYXMgYG51bGxgcy5cbiAqIFVzZSB0aGlzIHdoZW4gcHJlY2lzZSBpbmRleCBtYXR0ZXJzIChub3QgbWVyZWx5IHRoZSBvcmRlciBvZiB0aGUgZWxlbWVudHMpLlxuICpcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubnVsbFByb3BlcnRpZXM9PWZhbHNlXSAtIFByZXNlcnZlIHVuZGVmaW5lZCBvYmplY3QgcHJvcGVydGllcyBhcyBgbnVsbGBzLlxuICpcbiAqIEByZXR1cm5zIHtvYmplY3R9IC0gRGlzdGlsbGVkIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gdW5zdHJ1bmdpZnkob3B0aW9ucykge1xuICAgIHZhciBjbG9uZSwgcHJlc2VydmUsXG4gICAgICAgIG9iamVjdCA9ICh0eXBlb2YgdGhpcy50b0pTT04gPT09ICdmdW5jdGlvbicpID8gdGhpcy50b0pTT04oKSA6IHRoaXM7XG5cbiAgICBpZiAodW5zdHJ1bmdpZnkuaXNBcnJheShvYmplY3QpKSB7XG4gICAgICAgIGNsb25lID0gW107XG4gICAgICAgIHByZXNlcnZlID0gb3B0aW9ucyAmJiBvcHRpb25zLm51bGxFbGVtZW50cztcbiAgICAgICAgb2JqZWN0LmZvckVhY2goZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSB1bnN0cnVuZ2lmeS5jYWxsKG9iaik7XG4gICAgICAgICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsb25lLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcmVzZXJ2ZSkge1xuICAgICAgICAgICAgICAgIGNsb25lLnB1c2gobnVsbCk7IC8vIHVuZGVmaW5lZCBub3QgYSB2YWxpZCBKU09OIHZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSAgaWYgKHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNsb25lID0ge307XG4gICAgICAgIHByZXNlcnZlID0gb3B0aW9ucyAmJiBvcHRpb25zLm51bGxQcm9wZXJ0aWVzO1xuICAgICAgICBPYmplY3Qua2V5cyhvYmplY3QpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSB1bnN0cnVuZ2lmeS5jYWxsKG9iamVjdFtrZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xvbmVba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcmVzZXJ2ZSkge1xuICAgICAgICAgICAgICAgIGNsb25lW2tleV0gPSBudWxsOyAvLyB1bmRlZmluZWQgbm90IGEgdmFsaWQgSlNPTiB2YWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjbG9uZSA9IG9iamVjdDtcbiAgICB9XG5cbiAgICByZXR1cm4gY2xvbmU7XG59XG5cbi8qKlxuICogVmVyeSBzbG93IGFycmF5IHRlc3QuIFN1aXRhYmxlIGZvciBjcm9zcy1mcmFtZSBzY3JpcHRpbmcuXG4gKlxuICogU3VnZ2VzdGlvbjogSWYgeW91IG5lZWQgdGhpcyBhbmQgaGF2ZSBqUXVlcnkgbG9hZGVkLCB1c2UgYGpRdWVyeS5pc0FycmF5YCBpbnN0ZWFkIHdoaWNoIGlzIHJlYXNvbmFibHkgZmFzdC5cbiAqXG4gKiBAcGFyYW0geyp9IGFyciAtIFRoZSBvYmplY3QgdG8gdGVzdC5cbiAqIEByZXR1cm5zIHtib29sZWFufVxuICovXG51bnN0cnVuZ2lmeS5jcm9zc0ZyYW1lc0lzQXJyYXkgPSBmdW5jdGlvbihhcnIpIHsgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PT0gYXJyU3RyaW5nOyB9OyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsIGFyclN0cmluZyA9ICdbb2JqZWN0IEFycmF5XSc7XG5cbm1vZHVsZS5leHBvcnRzID0gdW5zdHJ1bmdpZnk7XG4iXX0=
