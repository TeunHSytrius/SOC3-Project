FROM node:24-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ backend/
RUN dotnet publish backend/Soc.Api/Soc.Api.csproj -c Release -o /out
COPY --from=frontend /src/frontend/dist/ /out/wwwroot/
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out/ ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet","Soc.Api.dll"]
