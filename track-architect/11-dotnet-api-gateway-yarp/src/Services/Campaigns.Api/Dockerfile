# syntax=docker/dockerfile:1
# Build context is the project root:  docker build -f src/Services/Campaigns.Api/Dockerfile .
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY src/Services/Campaigns.Api/Campaigns.Api.csproj src/Services/Campaigns.Api/
RUN dotnet restore src/Services/Campaigns.Api/Campaigns.Api.csproj
COPY src/Services/Campaigns.Api/ src/Services/Campaigns.Api/
RUN dotnet publish src/Services/Campaigns.Api/Campaigns.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app .
# Non-root: the base image ships an unprivileged user and exposes its id as APP_UID.
USER $APP_UID
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AdFlow.Campaigns.Api.dll"]
