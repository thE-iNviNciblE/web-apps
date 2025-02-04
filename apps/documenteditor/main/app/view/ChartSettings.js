/*
 *
 * (c) Copyright Ascensio System SIA 2010-2019
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-12 Ernesta Birznieka-Upisha
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
*/
/**
 *  ChartSettings.js
 *
 *  Created by Julia Radzhabova on 2/07/14
 *  Copyright (c) 2018 Ascensio System SIA. All rights reserved.
 *
 */

define([
    'text!documenteditor/main/app/template/ChartSettings.template',
    'jquery',
    'underscore',
    'backbone',
    'common/main/lib/component/Button',
    'common/main/lib/component/ComboDataView',
    'documenteditor/main/app/view/ImageSettingsAdvanced'
], function (menuTemplate, $, _, Backbone) {
    'use strict';

    DE.Views.ChartSettings = Backbone.View.extend(_.extend({
        el: '#id-chart-settings',

        // Compile our stats template
        template: _.template(menuTemplate),

        // Delegated events for creating new items, and clearing completed ones.
        events: {
        },

        options: {
            alias: 'ChartSettings'
        },

        initialize: function () {
            this._initSettings = true;

            this._state = {
                WrappingStyle: Asc.c_oAscWrapStyle2.Inline,
                CanBeFlow: true,
                Width: 0,
                Height: 0,
                FromGroup: false,
                ChartStyle: 1,
                ChartType: -1,
                SeveralCharts: false,
                DisabledControls: false
            };
            this.lockedControls = [];
            this._locked = false;

            this._noApply = false;
            this._originalProps = null;

            this.render();
        },

        render: function () {
            var el = this.$el || $(this.el);
            el.html(this.template({
                scope: this
            }));

            this.labelWidth = el.find('#chart-label-width');
            this.labelHeight = el.find('#chart-label-height');
            this.NotCombinedSettings = $('.not-combined');
        },

        setApi: function(api) {
            this.api = api;
            if (this.api) {
                this.api.asc_registerCallback('asc_onImgWrapStyleChanged', _.bind(this._ChartWrapStyleChanged, this));
                this.api.asc_registerCallback('asc_onUpdateChartStyles', _.bind(this._onUpdateChartStyles, this));
                this.api.asc_registerCallback('asc_onAddChartStylesPreview', _.bind(this.onAddChartStylesPreview, this));
            }
            return this;
        },

        ChangeSettings: function(props) {
            if (this._initSettings)
                this.createDelayedElements();

            this.disableControls(this._locked);

            if (props  && props.get_ChartProperties()){
                this._originalProps = new Asc.asc_CImgProperty(props);

                this._noApply = true;
                var value = props.get_WrappingStyle();
                if (this._state.WrappingStyle!==value) {
                    this.cmbWrapType.suspendEvents();
                    var rec = this.cmbWrapType.menuPicker.store.findWhere({
                        data: value
                    });
                    this.cmbWrapType.menuPicker.selectRecord(rec);
                    this.cmbWrapType.resumeEvents();
                    this._state.WrappingStyle=value;
                }

                this.chartProps = props.get_ChartProperties();

                value = props.get_SeveralCharts() || this._locked;
                if (this._state.SeveralCharts!==value) {
                    this.btnEditData.setDisabled(value);
                    this._state.SeveralCharts=value;
                }

                value = props.get_SeveralChartTypes();
                if (this._state.SeveralCharts && value) {
                    this.btnChartType.setIconCls('svgicon');
                    this._state.ChartType = null;
                } else {
                    var type = this.chartProps.getType();
                    if (this._state.ChartType !== type) {
                        var record = this.mnuChartTypePicker.store.findWhere({type: type});
                        this.mnuChartTypePicker.selectRecord(record, true);
                        if (record) {
                            this.btnChartType.setIconCls('svgicon ' + 'chart-' + record.get('iconCls'));
                        } else
                            this.btnChartType.setIconCls('svgicon');
                        this.ShowCombinedProps(type);
                        !(type===null || type==Asc.c_oAscChartTypeSettings.comboBarLine || type==Asc.c_oAscChartTypeSettings.comboBarLineSecondary ||
                        type==Asc.c_oAscChartTypeSettings.comboAreaBar || type==Asc.c_oAscChartTypeSettings.comboCustom) && this.updateChartStyles(this.api.asc_getChartPreviews(type, undefined, true));
                        this._state.ChartType = type;
                    }
                }

                if (!(type==Asc.c_oAscChartTypeSettings.comboBarLine || type==Asc.c_oAscChartTypeSettings.comboBarLineSecondary ||
                    type==Asc.c_oAscChartTypeSettings.comboAreaBar || type==Asc.c_oAscChartTypeSettings.comboCustom)) {
                    value = props.get_SeveralChartStyles();
                    if (this._state.SeveralCharts && value) {
                        this.cmbChartStyle.fieldPicker.deselectAll();
                        this.cmbChartStyle.menuPicker.deselectAll();
                        this._state.ChartStyle = null;
                    } else {
                        value = this.chartProps.getStyle();
                        if (this._state.ChartStyle !== value || this._isChartStylesChanged) {
                            this._state.ChartStyle = value;
                            var arr = this.selectCurrentChartStyle();
                            this._isChartStylesChanged && this.api.asc_generateChartPreviews(this._state.ChartType, arr);
                        }
                    }
                    this._isChartStylesChanged = false;
                }

                this._noApply = false;

                value = props.get_CanBeFlow() && !this._locked;
                var fromgroup = props.get_FromGroup() || this._locked;
                if (this._state.CanBeFlow!==value || this._state.FromGroup!==fromgroup) {
                    this.cmbWrapType.setDisabled(!value || fromgroup);
                    this._state.CanBeFlow=value;
                    this._state.FromGroup=fromgroup;
                }

                value = props.get_Width();
                if ( Math.abs(this._state.Width-value)>0.001 ) {
                    this.labelWidth[0].innerHTML = this.textWidth + ': ' + Common.Utils.Metric.fnRecalcFromMM(value).toFixed(1) + ' ' + Common.Utils.Metric.getCurrentMetricName();
                    this._state.Width = value;
                }

                value = props.get_Height();
                if ( Math.abs(this._state.Height-value)>0.001 ) {
                    this.labelHeight[0].innerHTML = this.textHeight + ': ' + Common.Utils.Metric.fnRecalcFromMM(value).toFixed(1) + ' ' + Common.Utils.Metric.getCurrentMetricName();
                    this._state.Height = value;
                }
            }
        },

        updateMetricUnit: function() {
            var value = Common.Utils.Metric.fnRecalcFromMM(this._state.Width);
            this.labelWidth[0].innerHTML = this.textWidth + ': ' + value.toFixed(1) + ' ' + Common.Utils.Metric.getCurrentMetricName();

            value = Common.Utils.Metric.fnRecalcFromMM(this._state.Height);
            this.labelHeight[0].innerHTML = this.textHeight + ': ' + value.toFixed(1) + ' ' + Common.Utils.Metric.getCurrentMetricName();
        },

        createDelayedControls: function() {
            var me = this,
                viewData = [
                { icon: 'btn-wrap-inline',      data: Asc.c_oAscWrapStyle2.Inline,      tip: this.txtInline, selected: true },
                { icon: 'btn-wrap-square',      data: Asc.c_oAscWrapStyle2.Square,      tip: this.txtSquare },
                { icon: 'btn-wrap-tight',       data: Asc.c_oAscWrapStyle2.Tight,       tip: this.txtTight },
                { icon: 'btn-wrap-through',     data: Asc.c_oAscWrapStyle2.Through,     tip: this.txtThrough },
                { icon: 'btn-wrap-topbottom',   data: Asc.c_oAscWrapStyle2.TopAndBottom, tip: this.txtTopAndBottom },
                { icon: 'btn-wrap-infront',     data: Asc.c_oAscWrapStyle2.InFront,     tip: this.txtInFront },
                { icon: 'btn-wrap-behind',      data: Asc.c_oAscWrapStyle2.Behind,      tip: this.txtBehind }
            ];

            this.cmbWrapType = new Common.UI.ComboDataView({
                itemWidth: 50,
                itemHeight: 50,
                menuMaxHeight: 300,
                enableKeyEvents: true,
                store: new Common.UI.DataViewStore(viewData),
                cls: 'combo-chart-style',
                dataHint: '1',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big',
                delayRenderTips: true,
                itemTemplate: _.template([
                    '<div class="item-icon-box" id="<%= id %>">',
                        '<img src="data:image/gif;base64,R0lGODlhAQABAID/AMDAwAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" ' +
                            'class="combo-wrap-item options__icon options__icon-huge <%= icon %>" ',
                    '</div>'
                ].join(''))
            });
            this.cmbWrapType.render($('#chart-combo-wrap'));
            this.cmbWrapType.openButton.menu.cmpEl.css({
                'min-width': 178,
                'max-width': 178
            });
            this.cmbWrapType.on('click', _.bind(this.onSelectWrap, this));
            this.cmbWrapType.openButton.menu.on('show:after', function () {
                me.cmbWrapType.menuPicker.scroller.update({alwaysVisibleY: true});
            });
            this.lockedControls.push(this.cmbWrapType);

            this.btnChartType = new Common.UI.Button({
                cls         : 'btn-large-dataview',
                iconCls     : 'svgicon chart-column-normal',
                menu        : new Common.UI.Menu({
                    style: 'width: 364px;',
                    items: [
                        { template: _.template('<div id="id-chart-menu-type" class="menu-insertchart" ></div>') }
                    ]
                }),
                dataHint: '1',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.btnChartType.on('render:after', function(btn) {
                me.mnuChartTypePicker = new Common.UI.DataView({
                    el: $('#id-chart-menu-type'),
                    parentMenu: btn.menu,
                    restoreHeight: 465,
                    groups: new Common.UI.DataViewGroupStore(Common.define.chartData.getChartGroupData()),
                    store: new Common.UI.DataViewStore(Common.define.chartData.getChartData()),
                    itemTemplate: _.template('<div id="<%= id %>" class="item-chartlist"><svg width="40" height="40" class=\"icon\"><use xlink:href=\"#chart-<%= iconCls %>\"></use></svg></div>'),
                    delayRenderTips: true,
                    delaySelect: Common.Utils.isSafari
                });
            });
            this.btnChartType.render($('#chart-button-type'));
            this.mnuChartTypePicker.on('item:click', _.bind(this.onSelectType, this, this.btnChartType));
            this.lockedControls.push(this.btnChartType);

            this.btnEditData = new Common.UI.Button({
                el: $('#chart-button-edit-data')
            });
            this.lockedControls.push(this.btnEditData);
            this.btnEditData.on('click', _.bind(this.setEditData, this));

            this.linkAdvanced = $('#chart-advanced-link');
            $(this.el).on('click', '#chart-advanced-link', _.bind(this.openAdvancedSettings, this));
        },

        createDelayedElements: function() {
            this.createDelayedControls();
            this.updateMetricUnit();
            this._initSettings = false;
        },

        _ChartWrapStyleChanged: function(style) {
            if (!this.cmbWrapType) return;
            if (this._state.WrappingStyle!==style) {
                this.cmbWrapType.suspendEvents();
                var rec = this.cmbWrapType.menuPicker.store.findWhere({
                    data: style
                });
                this.cmbWrapType.menuPicker.selectRecord(rec);
                this.cmbWrapType.resumeEvents();
                this._state.WrappingStyle=style;
            }
        },

        onSelectWrap: function(combo, record) {
            if (this.api) {
                var props = new Asc.asc_CImgProperty(),
                    data = record.get('data');
                props.put_WrappingStyle(data);
                if (this._state.WrappingStyle===Asc.c_oAscWrapStyle2.Inline && data!==Asc.c_oAscWrapStyle2.Inline ) {
                    props.put_PositionH(new Asc.CImagePositionH());
                    props.get_PositionH().put_UseAlign(false);
                    props.get_PositionH().put_RelativeFrom(Asc.c_oAscRelativeFromH.Column);
                    var val = this._originalProps.get_Value_X(Asc.c_oAscRelativeFromH.Column);
                    props.get_PositionH().put_Value(val);

                    props.put_PositionV(new Asc.CImagePositionV());
                    props.get_PositionV().put_UseAlign(false);
                    props.get_PositionV().put_RelativeFrom(Asc.c_oAscRelativeFromV.Paragraph);
                    val = this._originalProps.get_Value_Y(Asc.c_oAscRelativeFromV.Paragraph);
                    props.get_PositionV().put_Value(val);
                }

                this.api.ImgApply(props);
            }
            this.fireEvent('editcomplete', this);
        },

        setEditData: function() {
            var diagramEditor = DE.getController('Common.Controllers.ExternalDiagramEditor').getView('Common.Views.ExternalDiagramEditor');
            if (diagramEditor) {
                diagramEditor.setEditMode(true);
                diagramEditor.show();

                var chart = this.api.asc_getChartObject();
                if (chart) {
                    diagramEditor.setChartData(new Asc.asc_CChartBinary(chart));
                }
            }
        },

        openAdvancedSettings: function(e) {
            if (this.linkAdvanced.hasClass('disabled')) return;

            var me = this;
            var win;
            if (me.api && !this._locked){
                var selectedElements = me.api.getSelectedElements();
                if (selectedElements && selectedElements.length>0){
                    var elType, elValue;
                    for (var i = selectedElements.length - 1; i >= 0; i--) {
                        elType = selectedElements[i].get_ObjectType();
                        elValue = selectedElements[i].get_ObjectValue();
                        if (Asc.c_oAscTypeSelectElement.Image == elType) {
                            (new DE.Views.ImageSettingsAdvanced(
                                {
                                    imageProps: elValue,
                                    sectionProps: me.api.asc_GetSectionProps(),
                                    handler: function(result, value) {
                                        if (result == 'ok') {
                                            if (me.api) {
                                                me.api.ImgApply(value.imageProps);
                                            }
                                        }
                                        me.fireEvent('editcomplete', me);
                                    }
                            })).show();
                            break;
                        }
                    }
                }
            }
        },

        onSelectType: function(btn, picker, itemView, record) {
            if (this._noApply) return;

            var rawData = {},
                isPickerSelect = _.isFunction(record.toJSON);

            if (isPickerSelect){
                if (record.get('selected')) {
                    rawData = record.toJSON();
                } else {
                    // record deselected
                    return;
                }
            } else {
                rawData = record;
            }

            if (this.api && !this._noApply && this.chartProps) {
                var isCombo = (rawData.type==Asc.c_oAscChartTypeSettings.comboBarLine || rawData.type==Asc.c_oAscChartTypeSettings.comboBarLineSecondary ||
                               rawData.type==Asc.c_oAscChartTypeSettings.comboAreaBar || rawData.type==Asc.c_oAscChartTypeSettings.comboCustom);
                if (isCombo && this.chartProps.getSeries().length<2) {
                    Common.NotificationCenter.trigger('showerror', Asc.c_oAscError.ID.ComboSeriesError, Asc.c_oAscError.Level.NoCritical);
                    this.mnuChartTypePicker.selectRecord(this.mnuChartTypePicker.store.findWhere({type: this.chartProps.getType()}), true);
                } else {
                    this.btnChartType.setIconCls('svgicon ' + 'chart-' + rawData.iconCls);
                    this._state.ChartType = -1;
                    this.chartProps.changeType(rawData.type);
                }
            }
            this.fireEvent('editcomplete', this);
        },

        onSelectStyle: function(combo, record) {
            if (this._noApply) return;

            if (this.api && !this._noApply && this.chartProps) {
                var props = new Asc.asc_CImgProperty();
                this.chartProps.putStyle(record.get('data'));
                props.put_ChartProperties(this.chartProps);
                this.api.ImgApply(props);
            }
            this.fireEvent('editcomplete', this);
        },

        selectCurrentChartStyle: function() {
            if (!this.cmbChartStyle) return;

            this.cmbChartStyle.suspendEvents();
            var rec = this.cmbChartStyle.menuPicker.store.findWhere({data: this._state.ChartStyle});
            this.cmbChartStyle.menuPicker.selectRecord(rec);
            this.cmbChartStyle.resumeEvents();

            if (this._isChartStylesChanged) {
                var currentRecords;
                if (rec)
                    currentRecords = this.cmbChartStyle.fillComboView(this.cmbChartStyle.menuPicker.getSelectedRec(), true);
                else
                    currentRecords = this.cmbChartStyle.fillComboView(this.cmbChartStyle.menuPicker.store.at(0), true);
                if (currentRecords && currentRecords.length>0) {
                    var arr = [];
                    _.each(currentRecords, function(style, index){
                        arr.push(style.get('data'));
                    });
                    return arr;
                }
            }
        },

        onAddChartStylesPreview: function(styles){
            if (!this.cmbChartStyle) return;

            var me = this;
            if (styles && styles.length>0){
                var stylesStore = this.cmbChartStyle.menuPicker.store;
                if (stylesStore) {
                    _.each(styles, function(item, index){
                        var rec = stylesStore.findWhere({
                            data: item.asc_getName()
                        });
                        rec && rec.set('imageUrl', item.asc_getImage());
                    });
                }
            }
        },

        _onUpdateChartStyles: function() {
            if (this.api && this._state.ChartType!==null && this._state.ChartType>-1 &&
                !(this._state.ChartType==Asc.c_oAscChartTypeSettings.comboBarLine || this._state.ChartType==Asc.c_oAscChartTypeSettings.comboBarLineSecondary ||
                this._state.ChartType==Asc.c_oAscChartTypeSettings.comboAreaBar || this._state.ChartType==Asc.c_oAscChartTypeSettings.comboCustom)) {
                this.updateChartStyles(this.api.asc_getChartPreviews(this._state.ChartType, undefined, true));
                this.api.asc_generateChartPreviews(this._state.ChartType, this.selectCurrentChartStyle());
            }
        },

        updateChartStyles: function(styles) {
            var me = this;
            this._isChartStylesChanged = true;

            if (!this.cmbChartStyle) {
                this.cmbChartStyle = new Common.UI.ComboDataView({
                    itemWidth: 50,
                    itemHeight: 50,
                    menuMaxHeight: 270,
                    enableKeyEvents: true,
                    cls: 'combo-chart-style',
                    dataHint: '1',
                    dataHintDirection: 'bottom',
                    dataHintOffset: 'big',
                    delayRenderTips: true
                });
                this.cmbChartStyle.render($('#chart-combo-style'));
                this.cmbChartStyle.openButton.menu.cmpEl.css({
                    'min-width': 178,
                    'max-width': 178
                });
                this.cmbChartStyle.on('click', _.bind(this.onSelectStyle, this));
                this.cmbChartStyle.openButton.menu.on('show:after', function () {
                    me.cmbChartStyle.menuPicker.scroller.update({alwaysVisibleY: true});
                });
                this.lockedControls.push(this.cmbChartStyle);
            }

            if (styles && styles.length>0){
                var stylesStore = this.cmbChartStyle.menuPicker.store;
                if (stylesStore) {
                    var stylearray = [];
                    _.each(styles, function(item, index){
                        stylearray.push({
                            imageUrl: item.asc_getImage(),
                            data    : item.asc_getName(),
                            tip     : me.textStyle + ' ' + item.asc_getName()
                        });
                    });
                    stylesStore.reset(stylearray, {silent: false});
                }
            } else {
                this.cmbChartStyle.menuPicker.store.reset();
                this.cmbChartStyle.clearComboView();
            }
            this.cmbChartStyle.setDisabled(!styles || styles.length<1 || this._locked);
        },

        ShowCombinedProps: function(type) {
            this.NotCombinedSettings.toggleClass('settings-hidden', type===null || type==Asc.c_oAscChartTypeSettings.comboBarLine || type==Asc.c_oAscChartTypeSettings.comboBarLineSecondary ||
                type==Asc.c_oAscChartTypeSettings.comboAreaBar || type==Asc.c_oAscChartTypeSettings.comboCustom);
        },

        setLocked: function (locked) {
            this._locked = locked;
        },

        disableControls: function(disable) {
            if (this._initSettings) return;
            
            if (this._state.DisabledControls!==disable) {
                this._state.DisabledControls = disable;
                _.each(this.lockedControls, function(item) {
                    item.setDisabled(disable);
                });
                this.linkAdvanced.toggleClass('disabled', disable);
            }
        },

        textSize:       'Size',
        textWrap:       'Wrapping Style',
        textWidth:      'Width',
        textHeight:     'Height',
        textAdvanced:   'Show advanced settings',
        txtInline: 'Inline',
        txtSquare: 'Square',
        txtTight: 'Tight',
        txtThrough: 'Through',
        txtTopAndBottom: 'Top and bottom',
        txtBehind: 'Behind',
        txtInFront: 'In front',
        textEditData: 'Edit Data',
        textChartType: 'Change Chart Type',
        textStyle:          'Style'

    }, DE.Views.ChartSettings || {}));
});