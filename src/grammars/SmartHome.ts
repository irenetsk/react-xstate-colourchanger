export const grammar = `
<grammar root="smarthome">

   <rule id="smarthome">
      <ruleref uri="#command"/><tag>out.command=rules.command</tag>
   </rule>

   <rule id="command">
      <ruleref uri="#manners"/>
      <one-of>
         <item> 
         <ruleref uri="#action1"/><tag>out.action = new Object(); out.action = rules.action1</tag>
         the 
         <ruleref uri="#object1"/><tag>out.object = new Object(); out.object = rules.object1</tag> 
         <item repeat="0-1"><ruleref uri="#action1"/></item>
         <tag>out.action = new Object(); out.action = rules.action1</tag>
         </item>

         <item> 
         <ruleref uri="#action2"/> <tag>out.action = new Object(); out.action = rules.action2</tag>
         the 
         <ruleref uri="#object2"/> <tag>out.object = new Object(); out.object = rules.object2</tag>
         </item>
      </one-of>
   </rule>

   <rule id="action1">
      <item repeat="0-1">
      <one-of>
         <item> turn </item>
         <item> off <tag>out="off";</tag></item>
         <item> on <tag>out="on";</tag></item>
         <item> turn off <tag>out="off";</tag></item>
         <item> turn on <tag>out="on";</tag></item>
      </one-of>
   </item>
   </rule>

    <rule id="action2">
      <item repeat="0-1">
      <one-of>
         <item> open <tag>out="open";</tag></item>
         <item> close <tag>out="close";</tag></item>
      </one-of>
   </item>
   </rule>

   <rule id="object1">
      <one-of> 
         <item> light </item> 
         <item> heat </item>
         <item> A C <tag>out='air conditioning';</tag></item> 
         <item> AC <tag>out='air conditioning';</tag></item> 
         <item> air conditioning </item> 
      </one-of> 
   </rule>

   <rule id="object2">
      <one-of> 
         <item> window </item> 
         <item> door </item> 
      </one-of> 
   </rule>

   <rule id="manners">
      <item repeat="0-1">please</item>
   </rule>

</grammar>
`