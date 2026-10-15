{{- define "adflow.name" -}}{{ default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}{{- end -}}
{{- define "adflow.fullname" -}}
{{- if .Values.fullnameOverride -}}{{ .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else -}}{{- $n := default .Chart.Name .Values.nameOverride -}}
{{- if contains $n .Release.Name -}}{{ .Release.Name | trunc 63 | trimSuffix "-" }}{{- else -}}{{ printf "%s-%s" .Release.Name $n | trunc 63 | trimSuffix "-" }}{{- end -}}
{{- end -}}{{- end -}}
{{- define "adflow.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{ include "adflow.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
{{- define "adflow.selectorLabels" -}}
app.kubernetes.io/name: {{ include "adflow.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
{{- define "adflow.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}{{ include "adflow.fullname" . }}{{- else -}}default{{- end -}}
{{- end -}}
