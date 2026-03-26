**Solar-Stats**

This is a pet project I largely vibe-coded with early cGPT to test out its capability. The React app pulls data from my solar inverter's API to render realtime metrics on my solar generation, energy usage, grid import and grid export data. Further it calculates in realtime the savings being made from using green energy vs grid import so I can get a sense of total cost of ownership and savings over adjustable time ranges. 

The purpose of this was really to have something to play with to see what AI was capable of at the time. I quickly found those edges and hand to intervene build out features, leaning on cGPT to get started and make suggestions. As such, here it is warts and all from some spare time in the evenings in 2023. Maybe I'll come back to it some day and see what the robots are capable of now. 

The app is deployed in AWS via CDK and is accessible at www.solar-stats.com.

## Rewrite Planning Docs

The current app is now treated as a reference artifact while a cleaner rewrite is defined and delivered in stages.

- Product brief: `docs/product-brief.md`
- Use cases: `docs/use-cases.md`
- Calculation spec: `docs/calculation-spec.md`
- Architecture: `docs/architecture.md`
- Delivery backlog: `docs/backlog.md`
