(function() {
    var sheet;
    var manager;
    var RangeRef = kendo.spreadsheet.RangeRef;
    var CellRef = kendo.spreadsheet.CellRef;
    var AxisManager = kendo.spreadsheet.AxisManager;
    var defaults = kendo.ui.Spreadsheet.prototype.options;
    var success = $.proxy(ok, null, true);
    var failure = $.proxy(ok, null, false);

    function getRef(ref) {
        return sheet._ref(ref);
    }

    module("Axis manager", {
        setup: function() {
            sheet = new kendo.spreadsheet.Sheet(defaults.rows, defaults.columns, defaults.rowHeight, defaults.columnWidth);
            manager = new AxisManager(sheet);
        }
    });

    test("deletes columns for the given range", function() {
        sheet.range("D:D").value("foo");
        sheet.range("C:C,A:B,C:C").select();
        manager.deleteSelectedColumns();
        equal(sheet.range("A:A").value(), "foo");
    });

    test("knows about hidden columns", function() {
        ok(!manager.includesHiddenColumns(getRef("A:D")));
        sheet.range("C:C").select();
        manager.hideSelectedColumns();
        ok(manager.includesHiddenColumns(getRef("A:D")));
    });

})();