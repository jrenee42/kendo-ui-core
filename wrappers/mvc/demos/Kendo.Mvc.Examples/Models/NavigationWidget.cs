﻿using System;
using System.Collections.Generic;
using System.Linq;

namespace Kendo.Mvc.Examples.Models
{
    public class NavigationWidget : NavigationItem
    {
        public string ThumbnailUrl { get; set; }
        public string Category { get; set; }
        public string SpriteCssClass { get; set; }
        public bool Tablet { get; set; }
        public bool Expanded { get; set; }
        public bool New { get; set; }
        public bool Beta { get; set; }
        public bool Pro { get; set; }
        public List<NavigationExample> Items { get; set; }
    }
}
