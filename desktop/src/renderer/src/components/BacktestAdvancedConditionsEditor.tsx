import {
Alert,
Box,
Button,
Chip,
Divider,
FormControl,
IconButton,
InputBase,
MenuItem,
Paper,
Select,
Stack,
Switch,
Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import type {
BacktestAdvancedConditionsPayload,
BacktestConditionGroupPayload,
BacktestConditionOperandPayload,
BacktestConditionRulePayload,
} from '../api/admin';
import {
ADVANCED_CONDITION_FIELDS,
ADVANCED_CONDITION_VALUE_TYPES,
createDefaultFieldOperand,
createDefaultGroup,
createDefaultRule,
createDefaultValueOperand,
fieldOptionsForSource,
getComparatorsForKind,
getOperandKind,
isNumericComparator,
reconcileRule,
type TimeframeOption,
} from './backtestAdvancedConditionUtils';
interface BacktestAdvancedConditionsEditorProps {
value: BacktestAdvancedConditionsPayload;
timeframeOptions: TimeframeOption[];
onChange: (value: BacktestAdvancedConditionsPayload) => void;
}
const updateGroupAtPath = (
group: BacktestConditionGroupPayload,
path: number[],
updater: (group: BacktestConditionGroupPayload) => BacktestConditionGroupPayload
): BacktestConditionGroupPayload => {
if (path.length === 0) {
return updater(group);
}
const [head, ...rest] = path;
return {
...group,
items: group.items.map((item, index) => {
if (index !== head || !item.group) return item;
return { ...item, group: updateGroupAtPath(item.group, rest, updater) };
}),
};
};
// Inline select styled like ChartLink tokens
const inlineSelectSx = {
fontSize: '0.8rem',
fontWeight: 500,
color: 'text.primary',
bgcolor: '#f3f6fa',
borderRadius: '6px',
px: 0.75,
py: 0.25,
border: '1px solid #dde3ed',
cursor: 'pointer',
'&:hover': { bgcolor: '#e8edf5', borderColor: '#b0bcd4' },
minWidth: 60,
height: 28,
'& .MuiSelect-select': { py: '2px', px: '6px', pr: '20px !important' },
'& .MuiOutlinedInput-notchedOutline': { border: 'none' },
'& .MuiSelect-icon': { right: 2, fontSize: '1rem', color: '#6b7a99' },
};
const timeframeSx = {
...inlineSelectSx,
color: '#1565c0',
bgcolor: '#e8f0fe',
borderColor: '#c5d8fa',
fontWeight: 600,
'&:hover': { bgcolor: '#d2e3fc', borderColor: '#93b8f9' },
};
const sourceSx = {
...inlineSelectSx,
color: '#6a1b9a',
bgcolor: '#f3e5f5',
borderColor: '#dab8f0',
'&:hover': { bgcolor: '#ead5f9', borderColor: '#c98df0' },
};
const fieldSx = {
...inlineSelectSx,
color: '#1b5e20',
bgcolor: '#e8f5e9',
borderColor: '#b2dfdb',
fontWeight: 600,
'&:hover': { bgcolor: '#dcedc8', borderColor: '#80cbc4' },
};
const comparatorSx = {
...inlineSelectSx,
color: '#e65100',
bgcolor: '#fff3e0',
borderColor: '#ffe0b2',
fontStyle: 'italic',
'&:hover': { bgcolor: '#ffe0b2', borderColor: '#ffcc80' },
};
const valueTypeSx = {
...inlineSelectSx,
color: '#4a4a4a',
bgcolor: '#f5f5f5',
borderColor: '#e0e0e0',
'&:hover': { bgcolor: '#eeeeee', borderColor: '#bdbdbd' },
};
const InlineSelect = ({
value,
onChange,
options,
sx,
minWidth,
}: {
value: string;
onChange: (v: string) => void;
options: Array<{ value: string; label: string }>;
sx?: object;
minWidth?: number;
}) => (
<Select
value={value}
onChange={(e) => onChange(e.target.value as string)}
input={<InputBase />}
sx={{ ...(sx ?? inlineSelectSx), minWidth: minWidth ?? 80 }}
size="small"
>
{options.map((opt) => (
<MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>
{opt.label}
</MenuItem>
))}
</Select>
);
const ValueInput = ({
operand,
onChange,
}: {
operand: Extract<BacktestConditionOperandPayload, { kind: 'VALUE' }>;
onChange: (op: BacktestConditionOperandPayload) => void;
}) => {
if (operand.valueType === 'BOOLEAN') {
return (
<InlineSelect
value={String(operand.value ?? 'true').toLowerCase() === 'true' ? 'true' : 'false'}
onChange={(v) => onChange({ ...operand, value: v })}
options={[{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }]}
sx={{ ...inlineSelectSx, color: '#00695c', bgcolor: '#e0f2f1', borderColor: '#b2dfdb', minWidth: 70 }}
minWidth={70}
/>
);
}
return (
<Box
component="input"
type={operand.valueType === 'DATE' ? 'date' : operand.valueType === 'NUMBER' ? 'number' : 'text'}
value={operand.value ?? ''}
aria-label="Value"
onChange={(e) => onChange({ ...operand, value: (e.target as HTMLInputElement).value })}
sx={{
fontSize: '0.8rem',
fontWeight: 600,
color: '#00695c',
bgcolor: '#e0f2f1',
borderRadius: '6px',
px: 1,
border: '1px solid #b2dfdb',
height: 28,
width: operand.valueType === 'DATE' ? 120 : 90,
outline: 'none',
'&:focus': { borderColor: '#26a69a', bgcolor: '#f0fafa' },
}}
/>
);
};
// A single condition row rendered as inline tokens (ChartLink style)
const ConditionRow = ({
rule,
index,
operator,
canDelete,
timeframeOptions,
onUpdate,
onDelete,
}: {
rule: BacktestConditionRulePayload;
index: number;
operator: 'AND' | 'OR';
canDelete: boolean;
timeframeOptions: TimeframeOption[];
onUpdate: (rule: BacktestConditionRulePayload) => void;
onDelete: () => void;
}) => {
const leftField = rule.left.kind === 'FIELD' ? rule.left : null;
const leftValue = rule.left.kind === 'VALUE' ? rule.left : null;
const rightField = rule.right.kind === 'FIELD' ? rule.right : null;
const rightValue = rule.right.kind === 'VALUE' ? rule.right : null;
const timeframeValue = `${rule.timeframeUnit}|${rule.timeframeInterval}`;
const leftKind = getOperandKind(rule.left);
const availableComparators = getComparatorsForKind(leftKind);
const numericOnly = isNumericComparator(rule.comparator);
// Right operand: when comparator requires numeric, only show numeric fields
const rightFieldOptions = numericOnly
  ? fieldOptionsForSource(rightField?.source ?? 'TRADING_SIGNAL').filter((f) => f.kind === 'NUMBER')
  : rightField ? fieldOptionsForSource(rightField.source) : [];

const handleUpdate = (updated: BacktestConditionRulePayload) => onUpdate(reconcileRule(updated, timeframeOptions));
return (
<Stack
direction="row"
spacing={0.5}
alignItems="center"
flexWrap="wrap"
useFlexGap
sx={{
py: 0.75,
px: 1,
borderRadius: 1.5,
bgcolor: '#fafcff',
border: '1px solid #e8edf5',
'&:hover': { bgcolor: '#f0f5ff', borderColor: '#c5d8fa' },
transition: 'all 0.15s',
}}
>
{/* Operator badge */}
<Box sx={{ minWidth: 34, display: 'flex', justifyContent: 'center' }}>
{index === 0 ? (
<Chip
label="IF"
size="small"
sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#1565c0', color: '#fff', borderRadius: '4px' }}
/>
) : (
<Chip
label={operator}
size="small"
sx={{
height: 20,
fontSize: '0.68rem',
fontWeight: 700,
bgcolor: operator === 'AND' ? '#2e7d32' : '#e65100',
color: '#fff',
borderRadius: '4px',
}}
/>
)}
</Box>
{/* Timeframe */}
<InlineSelect
value={timeframeValue}
onChange={(v) => {
const [unit, interval] = v.split('|');
handleUpdate({ ...rule, timeframeUnit: unit, timeframeInterval: Number(interval) });
}}
options={timeframeOptions.map((o) => ({ value: `${o.unit}|${o.interval}`, label: o.label }))}
sx={timeframeSx}
minWidth={80}
/>
{/* Left operand */}
<InlineSelect
value={rule.left.kind}
onChange={(v) => handleUpdate({ ...rule, left: v === 'VALUE' ? createDefaultValueOperand() : createDefaultFieldOperand() })}
options={[{ value: 'FIELD', label: 'Field' }, { value: 'VALUE', label: 'Value' }]}
sx={sourceSx}
minWidth={65}
/>
{leftField && (
<>
<InlineSelect
value={leftField.source}
onChange={(v) => {
const src = v as 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM';
handleUpdate({ ...rule, left: { kind: 'FIELD', source: src, field: fieldOptionsForSource(src)[0]?.value ?? '' } });
}}
options={ADVANCED_CONDITION_FIELDS.map((f) => ({ value: f.source, label: f.label }))}
sx={sourceSx}
minWidth={110}
/>
<InlineSelect
value={leftField.field}
onChange={(v) => handleUpdate({ ...rule, left: { ...leftField, field: v } })}
options={fieldOptionsForSource(leftField.source)}
sx={fieldSx}
minWidth={100}
/>
</>
)}
{leftValue && (
<>
<InlineSelect
value={leftValue.valueType}
onChange={(v) => handleUpdate({ ...rule, left: { ...leftValue, valueType: v as 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE' } })}
options={ADVANCED_CONDITION_VALUE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
sx={valueTypeSx}
minWidth={65}
/>
<ValueInput operand={leftValue} onChange={(op) => handleUpdate({ ...rule, left: op })} />
</>
)}
{/* Comparator — only shows comparators valid for the left operand's type */}
<InlineSelect
value={rule.comparator}
onChange={(v) => handleUpdate({ ...rule, comparator: v as BacktestConditionRulePayload['comparator'] })}
options={availableComparators}
sx={comparatorSx}
minWidth={100}
/>
{/* Right operand */}
<InlineSelect
value={rule.right.kind}
onChange={(v) => {
const defaultRight = numericOnly
  ? { kind: 'FIELD' as const, source: 'TRADING_SIGNAL' as const, field: 'currentClose' }
  : v === 'VALUE' ? createDefaultValueOperand() : createDefaultFieldOperand();
handleUpdate({ ...rule, right: defaultRight });
}}
options={[{ value: 'FIELD', label: 'Field' }, { value: 'VALUE', label: 'Value' }]}
sx={sourceSx}
minWidth={65}
/>
{rightField && (
<>
<InlineSelect
value={rightField.source}
onChange={(v) => {
const src = v as 'TRADING_SIGNAL' | 'TRADING_DAY_PARAM';
const srcFields = numericOnly
  ? fieldOptionsForSource(src).filter((f) => f.kind === 'NUMBER')
  : fieldOptionsForSource(src);
handleUpdate({ ...rule, right: { kind: 'FIELD', source: src, field: srcFields[0]?.value ?? '' } });
}}
options={ADVANCED_CONDITION_FIELDS.map((f) => ({ value: f.source, label: f.label }))}
sx={sourceSx}
minWidth={110}
/>
<InlineSelect
value={rightField.field}
onChange={(v) => handleUpdate({ ...rule, right: { ...rightField, field: v } })}
options={rightFieldOptions.length > 0 ? rightFieldOptions : fieldOptionsForSource(rightField.source)}
sx={fieldSx}
minWidth={100}
/>
</>
)}
{rightValue && (
<>
<InlineSelect
value={rightValue.valueType}
onChange={(v) => handleUpdate({ ...rule, right: { ...rightValue, valueType: v as 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE' } })}
options={numericOnly
  ? ADVANCED_CONDITION_VALUE_TYPES.filter((t) => t.value === 'NUMBER')
  : ADVANCED_CONDITION_VALUE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
sx={valueTypeSx}
minWidth={65}
/>
<ValueInput operand={rightValue} onChange={(op) => handleUpdate({ ...rule, right: op })} />
</>
)}
{/* Delete */}
<Box sx={{ ml: 'auto !important', pl: 0.5 }}>
<IconButton
size="small"
color="error"
aria-label="Delete condition"
onClick={onDelete}
disabled={!canDelete}
sx={{ p: 0.25, opacity: canDelete ? 0.7 : 0.3, '&:hover': { opacity: 1 } }}
>
<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
</IconButton>
</Box>
</Stack>
);
};
// Recursive group editor (ChartLink-style)
const ConditionGroupEditor = ({
label,
group,
path,
timeframeOptions,
onChange,
onDelete,
onClear,
depth,
}: {
label: string;
group: BacktestConditionGroupPayload;
path: number[];
timeframeOptions: TimeframeOption[];
onChange: (group: BacktestConditionGroupPayload) => void;
onDelete?: () => void;
onClear?: () => void;
depth?: number;
}) => {
const currentDepth = depth ?? 0;
const updateCurrentGroup = (updater: (current: BacktestConditionGroupPayload) => BacktestConditionGroupPayload) => {
onChange(updateGroupAtPath(group, path, updater));
};
const currentGroup = path.length === 0
? group
: path.reduce<BacktestConditionGroupPayload | undefined>(
(current, index) => current?.items[index]?.group,
group
) ?? group;
const borderColor = currentDepth === 0 ? '#c5d8fa' : '#dab8f0';
const headerBg = currentDepth === 0 ? '#e8f0fe' : '#f3e5f5';
const canClearRoot = path.length === 0 && currentGroup.items.length === 1 && Boolean(onClear);
return (
<Box
sx={{
border: `1.5px solid ${borderColor}`,
borderRadius: 2,
overflow: 'hidden',
}}
>
{/* Group header */}
<Stack
direction="row"
alignItems="center"
spacing={0.75}
flexWrap="wrap"
useFlexGap
sx={{
px: 1.5,
py: 0.75,
bgcolor: headerBg,
borderBottom: `1px solid ${borderColor}`,
}}
>
<Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ fontSize: '0.8rem' }}>
{label} passes
</Typography>
<FormControl size="small" sx={{ minWidth: 65 }}>
<Select
value={currentGroup.operator}
onChange={(e) => updateCurrentGroup((current) => ({ ...current, operator: e.target.value as 'AND' | 'OR' }))}
input={<InputBase />}
sx={{
...inlineSelectSx,
color: currentGroup.operator === 'AND' ? '#2e7d32' : '#e65100',
bgcolor: currentGroup.operator === 'AND' ? '#e8f5e9' : '#fff3e0',
borderColor: currentGroup.operator === 'AND' ? '#b2dfdb' : '#ffe0b2',
fontWeight: 700,
minWidth: 65,
}}
>
<MenuItem value="AND" sx={{ fontSize: '0.8rem', color: '#2e7d32', fontWeight: 600 }}>and</MenuItem>
<MenuItem value="OR" sx={{ fontSize: '0.8rem', color: '#e65100', fontWeight: 600 }}>or</MenuItem>
</Select>
</FormControl>
<Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
of the below conditions
<Box component="span" sx={{ ml: 0.5, color: '#888', fontStyle: 'italic' }}>
({currentGroup.items.length} item{currentGroup.items.length !== 1 ? 's' : ''})
</Box>
</Typography>
<Box sx={{ ml: 'auto !important' }}>
<Stack direction="row" spacing={0.5} alignItems="center">
<Button
size="small"
variant="text"
startIcon={<AddRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
onClick={() => updateCurrentGroup((current) => ({
...current,
items: [...current.items, { rule: createDefaultRule(timeframeOptions) }],
}))}
sx={{ fontSize: '0.72rem', py: 0.25, px: 0.75, minWidth: 0, color: '#1565c0' }}
>
Add condition
</Button>
<Button
size="small"
variant="text"
startIcon={<AddRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
onClick={() => updateCurrentGroup((current) => ({
...current,
items: [...current.items, { group: createDefaultGroup(timeframeOptions) }],
}))}
sx={{ fontSize: '0.72rem', py: 0.25, px: 0.75, minWidth: 0, color: '#6a1b9a' }}
>
Group ()
</Button>
{onDelete && (
<IconButton
size="small"
color="error"
onClick={onDelete}
sx={{ p: 0.25, opacity: 0.7, '&:hover': { opacity: 1 } }}
>
<RemoveRoundedIcon sx={{ fontSize: 15 }} />
</IconButton>
)}
</Stack>
</Box>
</Stack>
{/* Conditions list */}
<Stack spacing={0.5} sx={{ p: 1 }}>
{currentGroup.items.map((item, index) => {
if (item.rule) {
return (
<ConditionRow
key={`${path.join('-') || 'root'}-rule-${index}`}
rule={item.rule}
index={index}
operator={currentGroup.operator}
canDelete={currentGroup.items.length > 1 || canClearRoot}
timeframeOptions={timeframeOptions}
onUpdate={(updatedRule) => updateCurrentGroup((current) => ({
...current,
items: current.items.map((node, i) =>
i === index && node.rule ? { rule: updatedRule } : node
),
}))}
onDelete={() => {
if (currentGroup.items.length === 1 && path.length === 0) {
onClear?.();
return;
}
updateCurrentGroup((current) => ({
...current,
items: current.items.filter((_, i) => i !== index),
}));
}}
/>
);
}
if (!item.group) return null;
return (
<Box
key={`${path.join('-') || 'root'}-group-${index}`}
sx={{ pl: 1.5, borderLeft: '3px solid #e0e7f7' }}
>
<ConditionGroupEditor
label={`Group ${[...path, index].map((p) => p + 1).join('.')}`}
group={group}
path={[...path, index]}
timeframeOptions={timeframeOptions}
onChange={onChange}
depth={(currentDepth ?? 0) + 1}
onDelete={currentGroup.items.length > 1 ? () => updateCurrentGroup((current) => ({
...current,
items: current.items.filter((_, i) => i !== index),
})) : undefined}
/>
</Box>
);
})}
</Stack>
</Box>
);
};
const EmptyConditionState = ({
label,
timeframeOptions,
onCreate,
}: {
label: string;
timeframeOptions: TimeframeOption[];
onCreate: (group: BacktestConditionGroupPayload) => void;
}) => (
<Box
sx={{
border: '1.5px dashed #c5d8fa',
borderRadius: 2,
px: 2,
py: 1.5,
bgcolor: '#fafcff',
}}
>
<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
<Typography variant="body2" color="text.secondary">
No {label.toLowerCase()} conditions configured yet.
</Typography>
<Stack direction="row" spacing={0.5}>
<Button
size="small"
variant="text"
startIcon={<AddRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
onClick={() => onCreate({
operator: 'AND',
items: [{ rule: createDefaultRule(timeframeOptions) }],
})}
sx={{ fontSize: '0.72rem', py: 0.25, px: 0.75, minWidth: 0, color: '#1565c0' }}
>
Add condition
</Button>
<Button
size="small"
variant="text"
startIcon={<AddRoundedIcon sx={{ fontSize: '0.85rem !important' }} />}
onClick={() => onCreate(createDefaultGroup(timeframeOptions))}
sx={{ fontSize: '0.72rem', py: 0.25, px: 0.75, minWidth: 0, color: '#6a1b9a' }}
>
Group ()
</Button>
</Stack>
</Stack>
</Box>
);
export const BacktestAdvancedConditionsEditor = ({
value,
timeframeOptions,
onChange,
}: BacktestAdvancedConditionsEditorProps) => {
const enabled = Boolean(value.enabled);
return (
<Paper variant="outlined" data-testid="advanced-conditions-editor" sx={{ p: { xs: 1.5, md: 2 } }}>
<Stack spacing={1.75}>
{/* Header row */}
<Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
<Stack direction="row" spacing={1} alignItems="center">
<Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Advance Conditions</Typography>
<InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 16 }} />
</Stack>
<Stack
direction="row"
spacing={0.75}
alignItems="center"
sx={{
px: 1,
py: 0.5,
border: '1px solid',
borderColor: 'divider',
borderRadius: 999,
alignSelf: { xs: 'flex-start', sm: 'center' },
}}
>
<Typography variant="body2" color={!enabled ? 'text.primary' : 'text.secondary'} fontWeight={!enabled ? 700 : 400} sx={{ fontSize: '0.78rem' }}>
Basic
</Typography>
<Switch
size="small"
checked={enabled}
inputProps={{ 'aria-label': 'Enable Advance Conditions' }}
onChange={(e) => onChange({
enabled: e.target.checked,
 entry: value.entry ?? null,
 exit: value.exit ?? null,
})}
/>
<Typography variant="body2" color={enabled ? 'text.primary' : 'text.secondary'} fontWeight={enabled ? 700 : 400} sx={{ fontSize: '0.78rem' }}>
Advance
</Typography>
</Stack>
</Stack>
{/* Info chips */}
<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
<Chip size="small" label="Join keys: trade date + instrument" color="primary" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
<Chip size="small" label="Trading Signal rules also use timeframe" color="primary" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
<Chip size="small" label="Nested groups support complex logic" color="primary" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
</Stack>
{!enabled ? (
<Alert severity="info" variant="outlined" sx={{ py: 0.75, fontSize: '0.8rem' }}>
Enable Advance mode to gate entries and trigger exits based on Trading Signal and Trading Param conditions.
</Alert>
) : (
<Stack spacing={1.5}>
{/* Entry group */}
<Stack spacing={0.5} data-testid="advanced-entry-group">
<Stack direction="row" spacing={0.75} alignItems="center">
<Chip
size="small"
label="ENTRY"
sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#1b5e20', color: '#fff', borderRadius: '4px' }}
/>
<Typography variant="caption" color="text.secondary">
Open a position when these conditions are met on the trade date
</Typography>
</Stack>
{value.entry ? (
<ConditionGroupEditor
label="Entry"
group={value.entry}
path={[]}
timeframeOptions={timeframeOptions}
depth={0}
onChange={(entry) => onChange({ ...value, enabled: true, entry })}
onClear={() => onChange({ ...value, enabled: true, entry: null })}
/>
) : (
<EmptyConditionState
label="Entry"
timeframeOptions={timeframeOptions}
onCreate={(entry) => onChange({ ...value, enabled: true, entry })}
/>
)}
</Stack>
<Divider flexItem />
{/* Exit group */}
<Stack spacing={0.5} data-testid="advanced-exit-group">
<Stack direction="row" spacing={0.75} alignItems="center">
<Chip
size="small"
label="EXIT"
sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, bgcolor: '#b71c1c', color: '#fff', borderRadius: '4px' }}
/>
<Typography variant="caption" color="text.secondary">
Close the position early when these conditions are met
</Typography>
</Stack>
{value.exit ? (
<ConditionGroupEditor
label="Exit"
group={value.exit}
path={[]}
timeframeOptions={timeframeOptions}
depth={0}
onChange={(exit) => onChange({ ...value, enabled: true, exit })}
onClear={() => onChange({ ...value, enabled: true, exit: null })}
/>
) : (
<EmptyConditionState
label="Exit"
timeframeOptions={timeframeOptions}
onCreate={(exit) => onChange({ ...value, enabled: true, exit })}
/>
)}
</Stack>
</Stack>
)}
</Stack>
</Paper>
);
};
