(function(f, define){
    define([ "../kendo.core" ], f);
})(function(){

(function(kendo) {
    if (kendo.support.browser.msie && kendo.support.browser.version < 9) {
        return;
    }

    var $ = kendo.jQuery;
    var CellRef = kendo.spreadsheet.CellRef;

    var Clipboard = kendo.Class.extend({
        init: function(workbook) {
            this.workbook = workbook;
            this.origin = kendo.spreadsheet.NULLREF;
            this.iframe = document.createElement("iframe");
            this.iframe.className = "k-spreadsheet-clipboard-paste";
            this.menuInvoked = true;
            this._external = {};
            this._uid = kendo.guid();
            document.body.appendChild(this.iframe);
        },

        canCopy: function() {
            var status = {canCopy: true};
            var selection = this.workbook.activeSheet().select();
            if (selection === kendo.spreadsheet.NULLREF) {
                status.canCopy = false;
            }
            if (selection instanceof kendo.spreadsheet.UnionRef) {
                status.canCopy = false;
                status.multiSelection = true;
            }
            if (this.menuInvoked) {
                status.canCopy = false;
                status.menuInvoked = true;
            }
            return status;
        },

        canPaste: function() {
            var sheet = this.workbook.activeSheet();
            var ref = this.pasteRef();
            var status = {canPaste: true};
            if (ref === kendo.spreadsheet.NULLREF) {
                var external = this.isExternal();
                status.pasteOnMerged = this.intersectsMerged();
                status.canPaste = status.pasteOnMerged ? false : external;
                return status;
            }
            if (!ref.eq(sheet.unionWithMerged(ref))) {
                status.canPaste = false;
                status.pasteOnMerged = true;
            }
            if (this.menuInvoked) {
                status.canPaste = false;
                status.menuInvoked = true;
            }
            if (ref.bottomRight.row >= sheet._rows._count || ref.bottomRight.col >= sheet._columns._count) {
                status.canPaste = false;
                status.overflow = true;
            }
            return status;
        },

        intersectsMerged: function() {
            var sheet = this.workbook.activeSheet();
            var state = this.parse(this._external);
            this.origin = getSourceRef(state);
            var ref = this.pasteRef();
            return !ref.eq(sheet.unionWithMerged(ref));
        },

        copy: function() {
            var sheet = this.workbook.activeSheet();
            this.origin = sheet.select();
            this.contents = sheet.selection().getState();
            delete this._external.html;
            delete this._external.plain;
        },

        cut: function() {
            var sheet = this.workbook.activeSheet();
            this.copy();
            sheet.range(sheet.select()).clear();
        },

        pasteRef: function() {
            var sheet = this.workbook.activeSheet();
            var destination = sheet.activeCell().first();
            var originActiveCell = this.origin.first();
            var rowDelta = originActiveCell.row - destination.row;
            var colDelta = originActiveCell.col - destination.col;

            return this.origin.relative(rowDelta, colDelta, 3);
        },

        destroy: function() {
            document.body.removeChild(this.iframe);
        },

        paste: function() {
            var state = {};
            var sheet = this.workbook.activeSheet();
            if (this._isInternal()) {
                state = this.contents;
            } else {
                state = this.parse(this._external);
                this.origin = getSourceRef(state);
            }
            var pasteRef = this.pasteRef();
            sheet.range(pasteRef).setState(state, this);
            sheet.triggerChange({ recalc: true, ref: pasteRef });
        },

        external: function(data) {
            if (data && (data.html || data.plain)) {
                this._external = data;
            } else {
                return this._external;
            }
        },

        isExternal: function() {
            return this._external.hasOwnProperty("html") || this._external.hasOwnProperty("plain");
        },

        parse: function(data) {
            var state = newState();
            if (data.html) {
                var doc = this.iframe.contentWindow.document;
                doc.open();
                doc.write(data.html);
                doc.close();
                var table = $(doc).find("table:first");
                if (table.length) {
                    state = parseHTML(table.find("tbody:first"));
                } else if (!data.plain) {
                    var element = $(doc.body).find(":not(style)");
                    setStateData(state, 0, 0, cellState(element.text()));
                } else {
                    state = parseTSV(data.plain);
                }
            } else {
                state = parseTSV(data.plain);
            }
            return state;
        },

        _isInternal: function() {
            if (this._external.html === undefined) {
                return true;
            }
            var internalHTML = $("<div/>").html(this._external.html).find("table.kendo-clipboard-"+ this._uid).length ? true : false;
            var internalPlain = $("<div/>").html(this._external.plain).find("table.kendo-clipboard-"+ this._uid).length ? true : false;
            if (internalHTML || internalPlain) {
                return true;
            }
            return false;
        }
    });
    kendo.spreadsheet.Clipboard = Clipboard;

    function newState() {
        var ref = new CellRef(0, 0, 0);
        return {
            ref         : ref,
            mergedCells : [],
            data        : [],
            foreign     : true,
            origRef     : ref.toRangeRef()
        };
    }

    function setStateData(state, row, col, value) {
        var data = state.data || (state.data = []);
        if (!data[row]) {
            data[row] = [];
        }
        data[row][col] = value;
        var br = state.origRef.bottomRight;
        br.row = Math.max(br.row, row);
        br.col = Math.max(br.col, col);
    }

    function getSourceRef(state) {
        return state.origRef;
    }

    function stripStyle(style) {
        return style.replace(/^-(?:ms|moz|webkit)-/, "");
    }

    function borderObject(styles) {
        var obj = {};
        [
            "borderBottom",
            "borderRight",
            "borderLeft",
            "borderTop"
        ].forEach(function(key) {
            obj[key] = styles[key + "Style"] == "none" ? null : {
                size: 1,
                color: styles[key + "Color"]
            };
        });
        return obj;
    }

    function cellState(element) {
        var styles = window.getComputedStyle(element[0]);
        var text = element.text();
        var borders = borderObject(styles);
        var state = {
            value: text === "" ? null : text,
            borderBottom : borders.borderBottom,
            borderRight : borders.borderRight,
            borderLeft : borders.borderLeft,
            borderTop : borders.borderTop,
            fontSize : parseInt(styles["font-size"], 10)
        };

        if (styles["background-color"] !== "rgb(0, 0, 0)" && styles["background-color"] !== "rgba(0, 0, 0, 0)") {
            state.background = styles["background-color"];
        }
        if (styles.color !== "rgb(0, 0, 0)" && styles.color !== "rgba(0, 0, 0, 0)") {
            state.color = styles.color;
        }
        if (styles["text-decoration"] == "underline") {
            state.underline = true;
        }
        if (styles["font-style"] == "italic") {
            state.italic = true;
        }
        if (styles["font-weight"] == "bold") {
            state.bold = true;
        }
        if (stripStyle(styles["text-align"]) !== "right") {
            state.textAlign = stripStyle(styles["text-align"]);
        }
        if (styles["vertical-align"] !== "middle") {
            state.verticalAlign = styles["vertical-align"];
        }
        if (styles["word-wrap"] !== "normal" ) {
            state.wrap = true;
        }

        return state;
    }

    function parseHTML(tbody) {
        var state = newState();

        tbody.find("tr").each(function(rowIndex, tr) {
            $(tr).find("td").each(function(colIndex, td) {
                var rowspan = parseInt($(td).attr("rowspan"), 10) -1 || 0;
                var colspan = parseInt($(td).attr("colspan"), 10) -1 || 0;
                var blankCell = "<td/>";
                var ci;
                if (rowspan){
                    var endRow = rowIndex + rowspan;
                    for (var ri = rowIndex; ri <= endRow; ri++) {
                        var row = tbody.find("tr").eq(ri);
                        if (ri > rowIndex) {
                            blankCell = "<td class='rowspan'></td>";
                            if (colIndex === 0) {
                                row.find("td").eq(colIndex).after(blankCell);
                            } else {
                                var last = Math.min(row.find("td").length, colIndex);
                                row.find("td").eq(last - 1).after(blankCell);
                            }
                        }
                        if (colspan) {
                            for (ci = colIndex; ci < colspan + colIndex; ci++) {
                                blankCell = "<td class='rowspan colspan'></td>";
                                row.find("td").eq(ci).after(blankCell);
                            }
                        }
                    }
                } else {
                    if (colspan) {
                        for (ci = colIndex; ci < colspan + colIndex; ci++) {
                            blankCell = "<td class='colspan'></td>";
                            $(tr).find("td").eq(ci).after(blankCell);
                        }
                    }
                }
            });
        });

        tbody.find("tr").each(function(rowIndex, tr) {
            $(tr).find("td").each(function(colIndex, td) {
                var rowspan = parseInt($(td).attr("rowspan"), 10) -1 || 0;
                var colspan = parseInt($(td).attr("colspan"), 10) -1 || 0;
                setStateData(state, rowIndex, colIndex, cellState($(td)));
                if (rowspan || colspan) {
                    var startCol = String.fromCharCode(65 + colIndex);
                    var endCol = String.fromCharCode(65 + colIndex + colspan);
                    var address = startCol + (rowIndex + 1) + ":" + endCol + (rowIndex + 1 + rowspan);

                    state.mergedCells.push(address);
                }
            });
        });
        return state;
    }

    function parseTSV(data) {
        var state = newState();
        if (data.indexOf("\t") === -1 && data.indexOf("\n") == -1) {
            setStateData(state, 0, 0, { value: data });
        } else {
            var rows = data.split("\n");
            for (var ri = 0; ri < rows.length; ri++) {
                var cols = rows[ri].split("\t");
                for (var ci = 0; ci < cols.length; ci++) {
                    setStateData(state, ri, ci, { value: cols[ci] });
                }
            }
        }
        return state;
    }

})(kendo);
}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });
