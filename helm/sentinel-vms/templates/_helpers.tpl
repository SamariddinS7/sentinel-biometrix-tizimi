{{/*
Expand the name of the chart.
*/}}
{{- define "sentinel-vms.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "sentinel-vms.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart label.
*/}}
{{- define "sentinel-vms.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "sentinel-vms.labels" -}}
helm.sh/chart: {{ include "sentinel-vms.chart" . }}
{{ include "sentinel-vms.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "sentinel-vms.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sentinel-vms.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app: {{ include "sentinel-vms.name" . }}
{{- end }}

{{/*
Service account name.
*/}}
{{- define "sentinel-vms.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "sentinel-vms.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
