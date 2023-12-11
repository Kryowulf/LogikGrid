
var LogikGrid = (function() {
    
    var module = {} ;
    
    var State = 
    { 
        Blank: 0, 
        Crossed: 1, 
        Checked: 2 
    };
    
    var CssClass =
    {  
        Table:                  "LogikGrid_Table",
        Spacer:                 "LogikGrid_Spacer",    
                                          
        TopCategoryHeaderRow:   "LogikGrid_TopCategoryHeaderRow",  
        TopEntityHeaderRow:     "LogikGrid_TopEntityHeaderRow",  

        SideCategoryHeader:     "LogikGrid_SideCategoryHeader",  
        SideEntityHeader:       "LogikGrid_SideEntityHeader",

        CategoryTop:            "LogikGrid_CategoryTop",
        CategoryLeft:           "LogikGrid_CategoryLeft",
        CategoryRight:          "LogikGrid_CategoryRight",
        CategoryBottom:         "LogikGrid_CategoryBottom",

        DataCell:               "LogikGrid_DataCell",
        
        Disabled:               "LogikGrid_Disabled",

        SelectedRow:            "LogikGrid_SelectedRow",
        SelectedColumn:         "LogikGrid_SelectedColumn",
        
        CellHighlight0:         "LogikGrid_CellHighlight0",
        CellHighlight1:         "LogikGrid_CellHighlight1",
        CellHighlight2:         "LogikGrid_CellHighlight2",
        CellHighlight3:         "LogikGrid_CellHighlight3"
    };
    
    function squareArray(size)
    {
        var array = [];
        
        for (var i = 0 ; i < size ; i++)
        {
            array[i] = [];
        }
        
        return array;
    }
    
    function Coordinate(row, column)
    {
        this.row = row;
        this.column = column;
    }
    
    function Grid(categories)
    {
        this.total_categories = categories.length;
        this.category_size = categories[0].entities.length;
        this.total_entities = this.total_categories * this.category_size;
        this.categories = categories;
        this.cells = squareArray(this.total_entities);
        this.blocks = squareArray(this.total_categories);
        
        for ( var bi = 0 ; bi < this.total_categories ; bi++ )
        {
            for ( var bj = 0 ; bj < this.total_categories ; bj++ )
            {
                var block = new Block(this.category_size);
                
                for ( var ci = 0 ; ci < this.category_size ; ci++ )
                {
                    for ( var cj = 0 ; cj < this.category_size ; cj++ )
                    {
                        var i = bi * this.category_size + ci;
                        var j = bj * this.category_size + cj;
                        
                        var grid_coordinate = new Coordinate(i, j);
                        var block_coordinate = new Coordinate(ci, cj);
                        
                        var cell = new Cell(this, block, grid_coordinate, block_coordinate);
                        
                        if (bi == bj) 
                        { 
                            cell.enabled = false;
                            
                            if (ci == cj) { cell.state = State.Checked; }
                            else          { cell.state = State.Crossed; }
                        }
                        
                        block.cells[ci][cj] = cell;
                        this.cells[i][j] = cell;
                    }
                }
                
                this.blocks[bi][bj] = block;
            }
        }
    }
    
    function Block(category_size)
    {
        this.cells = squareArray(category_size);
    }
    
    function Cell(grid, block, grid_coordinate, block_coordinate)
    {
        this.grid = grid;
        this.block = block;
        this.grid_coordinate = grid_coordinate;
        this.block_coordinate = block_coordinate;
        this.enabled = true;
        this.state = State.Blank;
        this.listeners = [];
    }
    
    Cell.prototype.setState = function(state)
    {
        i = this.grid_coordinate.row;
        j = this.grid_coordinate.column;

        var self = this.grid.cells[i][j];
        var mirror = this.grid.cells[j][i];
        
        self.state = state;
        mirror.state = state;

        self.listeners.forEach(function(listener) { 
            listener.callback(self, listener.data); 
        });
        
        mirror.listeners.forEach(function(listener) { 
            listener.callback(mirror, listener.data); 
        });
    };
    
    Cell.prototype.addListener = function(callback, data)
    {
        var listener = {
            callback: callback,
            data: data
        };
        
        this.listeners.push(listener);
    };

    
    function Action(cell, oldstate, newstate)
    {
        this.cell = cell;
        this.oldstate = oldstate;
        this.newstate = newstate;
    }
    
    function GridController(grid)
    {
        this.grid = grid;
        this.toggled_cell = null;
        this.crossed_cells = [];
        this.undo_stack = [];
        this.redo_stack = [];
    }
    
    GridController.prototype.toggle = function(cell)
    {
        actionset = [];
        
        if (cell.state == State.Blank)
        {
            cell.setState(State.Crossed);
            actionset.push(new Action(cell, State.Blank, State.Crossed));
            this.toggled_cell = cell;
            this.crossed_cells = [];
        }
        else if (cell.state == State.Crossed)
        {
            if (cell === this.toggled_cell)
            {
                cell.setState(State.Checked);
                actionset.push(new Action(cell, State.Crossed, State.Checked));
                this.toggled_cell = cell;
                this.crossed_cells = [];
                
                var row = cell.block_coordinate.row;
                var column = cell.block_coordinate.column;
                var neighboring_cells = [];
                
                for ( var index = 0 ; index < cell.grid.category_size ; index++ )
                {
                    if (index != row)    { neighboring_cells.push(cell.block.cells[index][column]); }
                    if (index != column) { neighboring_cells.push(cell.block.cells[row][index]); }
                }
                
                var self = this;
                
                neighboring_cells.forEach(function(neighbor) {
                    if (neighbor.state == State.Blank)
                    {
                        neighbor.setState(State.Crossed);
                        actionset.push(new Action(neighbor, State.Blank, State.Crossed));
                        self.crossed_cells.push(neighbor);
                    }                    
                });
            }
            else
            {
                cell.setState(State.Blank);
                actionset.push(new Action(cell, State.Crossed, State.Blank));
                this.toggled_cell = cell;
                this.crossed_cells = [];
            }
        }
        else if (cell.state == State.Checked)
        {
            if (cell === this.toggled_cell)
            {
                this.crossed_cells.forEach(function(neighbor) {
                    neighbor.setState(State.Blank);
                    actionset.push(new Action(neighbor, State.Crossed, State.Blank));
                });
            }

            cell.setState(State.Blank);
            actionset.push(new Action(cell, State.Checked, State.Blank));
            this.toggled_cell = cell;
            this.crossed_cells = [];
        }
        
        this.undo_stack.push(actionset);
        this.redo_stack = [];
    };

    GridController.prototype.undo = function() {

        this.toggled_cell = null;
        this.crossed_cells = [];
    
        if (this.undo_stack.length > 0)
        {
            actionset = this.undo_stack.pop();
            
            actionset.forEach(function(action) {
                action.cell.setState(action.oldstate);
            });
            
            this.redo_stack.push(actionset);
        }
    };
    
    GridController.prototype.redo = function() {
        
        this.toggled_cell = null;
        this.crossed_cells = [];        
        
        if (this.redo_stack.length > 0)
        {
            actionset = this.redo_stack.pop();
            
            actionset.forEach(function(action) {
                action.cell.setState(action.newstate);
            });
            
            this.undo_stack.push(actionset);
        }
    };
    
    function GridView(controller)
    {
        this.controller = controller;
        this.grid = controller.grid;
        
        this.category_size = controller.grid.category_size;
        this.total_categories = controller.grid.total_categories;
        this.total_entities = controller.grid.total_entities;
        
        this.top_category_headers = [];
        this.top_entity_headers = [];
        this.side_category_headers = [];
        this.side_entity_headers = [];
        
        this.cells = squareArray(this.total_entities);
        
        var grid = this.grid;
        var spacer = function() { return $("<td>").addClass(CssClass.Spacer); }
        
        var top_category_header_row = 
            $("<tr>")
            .addClass(CssClass.TopCategoryHeaderRow)
            .append(spacer())
            .append(spacer());
    
        var top_entity_header_row =
            $("<tr>")
            .addClass(CssClass.TopEntityHeaderRow)
            .append(spacer())
            .append(spacer());
        
        var data_rows = [];
        
        for ( var i = 0 ; i < this.total_categories ; i++ )
        {
            var header;

            header = $("<th><div><span></span></div></th>");
            header.attr("colspan", this.category_size);
            header.find("span").text(grid.categories[i].name);
            top_category_header_row.append(header);
            this.top_category_headers.push(header);
            this.addTopCategorySelectionListener(i);
            
            header = $("<td><div><span></span></div></td>");
            header.attr("rowspan", this.category_size);
            header.find("span").text(grid.categories[i].name);
            header.addClass(CssClass.SideCategoryHeader);
            this.side_category_headers.push(header);
            this.addSideCategorySelectionListener(i);
            
            for ( var j = 0 ; j < this.category_size ; j++ )
            {
                header = $("<th><div><span></span></div></th>");                
                header.find("span").text(grid.categories[i].entities[j]);
                if (j == 0) { header.addClass(CssClass.CategoryLeft); } 
                if (j == this.category_size - 1) { header.addClass(CssClass.CategoryRight); } 
                top_entity_header_row.append(header);
                this.top_entity_headers.push(header);
                this.addTopEntitySelectionListener(i * this.category_size + j);
                
                header = $("<td><div><span></span></div></td>");
                header.find("span").text(grid.categories[i].entities[j]);
                header.addClass(CssClass.SideEntityHeader);
                if (j == 0) { header.addClass(CssClass.CategoryTop); } 
                if (j == this.category_size - 1) { header.addClass(CssClass.CategoryBottom); }
                this.side_entity_headers.push(header);
                this.addSideEntitySelectionListener(i * this.category_size + j);
            }
        }
        
        for ( var bi = 0 ; bi < this.total_categories ; bi++ )
        {
            for ( var bj = 0 ; bj < this.total_categories ; bj++ )
            {
                for ( var ci = 0 ; ci < this.category_size ; ci++ )
                {
                    for ( var cj = 0 ; cj < this.category_size ; cj++ )
                    {
                        var i = bi * this.category_size + ci;
                        var j = bj * this.category_size + cj;
                        
                        var coordinate = new Coordinate(i, j);
                        var cell_view = new CellView(this, coordinate, grid.cells[i][j]);

                        cell_view.dom_element.addClass(CssClass.DataCell);
                        
                        if ( ci == 0 ) 
                            { cell_view.dom_element.addClass(CssClass.CategoryTop); }
                        
                        if ( ci == this.category_size - 1) 
                            { cell_view.dom_element.addClass(CssClass.CategoryBottom); } 
                        
                        if ( cj == 0 )
                            { cell_view.dom_element.addClass(CssClass.CategoryLeft); }

                        if ( cj == this.category_size - 1) 
                            { cell_view.dom_element.addClass(CssClass.CategoryRight); }                         
                        
                        if (cell_view.cell.enabled == false)
                            { cell_view.dom_element.addClass(CssClass.Disabled); }
                        
                        cell_view.update();
                        
                        this.cells[i][j] = cell_view;
                        this.addCellSelectionListener(cell_view);
                    }
                }
            }
        }
        
        for ( var i = 0 ; i < this.total_entities ; i++ )
        {
            var row = $("<tr>");
            
            if ( i % this.category_size == 0 )
            {
                var category_index = Math.floor(i / this.category_size);
                row.addClass(CssClass.CategoryTop); 
                row.append(this.side_category_headers[category_index]);
            }
            
            if ( (i+1) % this.category_size == 0 )
            { 
                row.addClass(CssClass.CategoryBottom); 
            }
            
            row.append(this.side_entity_headers[i]);
            
            for ( var j = 0 ; j < this.total_entities ; j++ )
            {
                row.append(this.cells[i][j].dom_element);
            }
            
            data_rows.push(row);
        }
        
        this.table = 
            $("<table>")
            .addClass(CssClass.Table)
            .append(
                $("<thead>")
                .append(top_category_header_row)
                .append(top_entity_header_row))
            .append(
                $("<tbody>")
                .append(data_rows));
    }
    
    function CellView(grid_view, coordinate, cell)
    {
        this.grid_view = grid_view;
        this.coordinate = coordinate;
        this.cell = cell;
        this.dom_element = $("<td>");
        this.highlight_setting = 0
        
        var self = this;
        var data = null;
        
        this.cell.addListener(function() { self.update(); }, data);
        this.dom_element.click(function() { self.click(); });
        this.dom_element.mousedown(function(e) { self.mousedown(e); });
    }
    
    GridView.prototype.addTopCategorySelectionListener = function(index)
    {
        var header = this.top_category_headers[index];
        
        header.mouseover(function() {
            header.addClass(CssClass.SelectedColumn);
        });
        
        header.mouseout(function() {
            header.removeClass(CssClass.SelectedColumn);
        });
    };
    
    GridView.prototype.addSideCategorySelectionListener = function(index)
    {
        var header = this.side_category_headers[index];
        
        header.mouseover(function() {
            header.addClass(CssClass.SelectedRow);
        });
        
        header.mouseout(function() {
            header.removeClass(CssClass.SelectedRow);
        });        
    };
    
    GridView.prototype.addTopEntitySelectionListener = function(index)
    {
        // Incompatible with current CSS.
        
        /*
        var category_index = Math.floor(index / this.category_size);
        
        var category_header = this.top_category_headers[category_index];
        var header = this.top_entity_headers[index];
        
        header.mouseover(function() {
            category_header.addClass(CssClass.SelectedColumn);
            header.addClass(CssClass.SelectedColumn);
        });
        
        header.mouseout(function() {
            category_header.removeClass(CssClass.SelectedColumn);
            header.removeClass(CssClass.SelectedColumn);
        });        
        */
    };
    
    GridView.prototype.addSideEntitySelectionListener = function(index)
    {
        var category_index = Math.floor(index / this.category_size);
        
        var category_header = this.side_category_headers[category_index];
        var header = this.side_entity_headers[index];
        
        header.mouseover(function() {
            category_header.addClass(CssClass.SelectedRow);
            header.addClass(CssClass.SelectedRow);
        });
        
        header.mouseout(function() {
            category_header.removeClass(CssClass.SelectedRow);
            header.removeClass(CssClass.SelectedRow);
        });                
    };
    
    GridView.prototype.addCellSelectionListener = function(cell_view)
    {
        var row_index = cell_view.coordinate.row;
        var column_index = cell_view.coordinate.column;
        
        var category_row_index = Math.floor(row_index / this.category_size);
        var category_column_index = Math.floor(column_index / this.category_size);
        
        var top_category_header = this.top_category_headers[category_column_index];
        var top_entity_header = this.top_entity_headers[column_index];
        
        var side_category_header = this.side_category_headers[category_row_index];
        var side_entity_header = this.side_entity_headers[row_index];

        var self = this;
        
        cell_view.dom_element.mouseover(function() {
            
            top_category_header.addClass(CssClass.SelectedColumn);
            top_entity_header.addClass(CssClass.SelectedColumn);
            
            side_category_header.addClass(CssClass.SelectedRow);
            side_entity_header.addClass(CssClass.SelectedRow);
            
            for (var i = 0 ; i < self.total_entities ; i++)
            {
                self.cells[i][column_index].dom_element.addClass(CssClass.SelectedColumn);
                self.cells[row_index][i].dom_element.addClass(CssClass.SelectedRow);
            }
            
        });
        
        cell_view.dom_element.mouseout(function() {
            
            top_category_header.removeClass(CssClass.SelectedColumn);
            top_entity_header.removeClass(CssClass.SelectedColumn);
            
            side_category_header.removeClass(CssClass.SelectedRow);
            side_entity_header.removeClass(CssClass.SelectedRow);
            
            for (var i = 0 ; i < self.total_entities ; i++)
            {
                self.cells[i][column_index].dom_element.removeClass(CssClass.SelectedColumn);
                self.cells[row_index][i].dom_element.removeClass(CssClass.SelectedRow);
            }            
            
        });
    };
    
    CellView.prototype.click = function()
    {
        if (this.cell.enabled)
        {
            this.grid_view.controller.toggle(this.cell);
        }
    };

    CellView.prototype.update = function() 
    {
        switch(this.cell.state)
        {
            case State.Blank:
                this.dom_element.text('');
            break;
            
            case State.Crossed:
                this.dom_element.text('x');
            break;
            
            case State.Checked:
                this.dom_element.text('O');
            break;
        }
    };
    
    CellView.prototype.mousedown = function(e)
    {
        if (e.which == 2)
        {
            var i = this.coordinate.row;
            var j = this.coordinate.column;
            
            self = this.grid_view.cells[i][j];
            mirror = this.grid_view.cells[j][i];
            
            self.cycleHighlight();
            mirror.cycleHighlight();
        }
    };
    
    CellView.prototype.cycleHighlight = function()
    {
        switch(this.highlight_setting)
        {
            case 0:
                this.dom_element.removeClass(CssClass.CellHighlight0);
                this.dom_element.addClass(CssClass.CellHighlight1);
                this.highlight_setting = 1;
                break;
                
            case 1:
                this.dom_element.removeClass(CssClass.CellHighlight1);
                this.dom_element.addClass(CssClass.CellHighlight2);
                this.highlight_setting = 2;
                break;
            
            case 2:
                this.dom_element.removeClass(CssClass.CellHighlight2);
                this.dom_element.addClass(CssClass.CellHighlight3);
                this.highlight_setting = 3;
                break;

            case 3:
                this.dom_element.removeClass(CssClass.CellHighlight3);
                this.dom_element.addClass(CssClass.CellHighlight0);
                this.highlight_setting = 0;
                break;
        }
    };
    
    module.Grid = Grid;
    module.GridController = GridController;
    module.GridView = GridView;
    
    return module;
    
})();
