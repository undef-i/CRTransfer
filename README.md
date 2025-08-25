# CRTransfer  

铁路换乘查询工具，使用 Dijkstra 算法计算某两个车站之间最快的换乘方式。

## 使用

访问 https://crtransfer.noxylva.org/ 


## 构建

```
npm run build
```


## 贡献

[data/sl.json](data/sl.json) 中的站点位置和线路信息目前通过手工维护，基于 WGS-84 坐标系。
如果您发现任何站点位置或线路信息的错误，欢迎提交贡献，共同提升数据的准确性。
尚未修复的已知问题记录在 [data_issues.md](data_issues.md) 。

## 已知问题

- 计算时未考虑非每日开行列车数据
- 站点位置信息有较多错误
- 受铁路运行图调整或其他不可控因素影响
