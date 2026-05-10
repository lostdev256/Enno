import {EnnoDatabaseInfo, uuid} from "./utils";

export class StorylineEnnoDatabase {
    constructor(private _dbInfo: EnnoDatabaseInfo) {
    }

    getStorylineData(): any {
        const nodes = this._dbInfo.db.prepare("SELECT id, node_type AS nodeType, ref_id AS refId, data, group_id AS groupId, x, y FROM storyline_nodes").all();
        const connections = this._dbInfo.db.prepare("SELECT id, source_node_id AS sourceNodeId, source_pin AS sourcePin, target_node_id AS targetNodeId, target_pin AS targetPin FROM storyline_connections").all();
        const groupPositions = this._dbInfo.db.prepare("SELECT group_id AS groupId, x, y, width, height FROM storyline_group_positions").all();
        return {nodes, connections, groupPositions};
    }

    addStorylineNode(nodeType: string, refId: string | null, groupId: string | null, x: number, y: number, data?: string): any {
        const id = uuid();
        this._dbInfo.db.prepare("INSERT INTO storyline_nodes (id,node_type,ref_id,data,group_id,x,y) VALUES (?,?,?,?,?,?,?)").run(id, nodeType, refId, data || "{}", groupId, x, y);
        return {id, nodeType, refId, data: data || "{}", groupId, x, y};
    }

    updateStorylineNode(id: string, x: number, y: number, groupId?: string | null): boolean {
        if (groupId !== undefined) {
            return this._dbInfo.db.prepare("UPDATE storyline_nodes SET x = ?, y = ?, group_id = ? WHERE id = ?").run(x, y, groupId, id).changes > 0;
        }
        return this._dbInfo.db.prepare("UPDATE storyline_nodes SET x = ?, y = ? WHERE id = ?").run(x, y, id).changes > 0;
    }

    updateStorylineNodeData(id: string, data: string): boolean {
        return this._dbInfo.db.prepare("UPDATE storyline_nodes SET data = ? WHERE id = ?").run(data, id).changes > 0;
    }

    deleteStorylineNode(id: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM storyline_nodes WHERE id = ?").run(id).changes > 0;
    }

    createStorylineConnection(sourceNodeId: string, sourcePin: string, targetNodeId: string, targetPin: string): any {
        const id = uuid();
        this._dbInfo.db.prepare("INSERT INTO storyline_connections (id,source_node_id,source_pin,target_node_id,target_pin) VALUES (?,?,?,?,?)").run(id, sourceNodeId, sourcePin, targetNodeId, targetPin);
        return {id, sourceNodeId, sourcePin, targetNodeId, targetPin};
    }

    deleteStorylineConnection(id: string): boolean {
        return this._dbInfo.db.prepare("DELETE FROM storyline_connections WHERE id = ?").run(id).changes > 0;
    }

    updateStorylineGroupPosition(groupId: string, x: number, y: number, width: number, height: number): void {
        const exists = this._dbInfo.db.prepare("SELECT 1 FROM storyline_group_positions WHERE group_id = ?").get(groupId);
        if (exists) {
            this._dbInfo.db.prepare("UPDATE storyline_group_positions SET x=?,y=?,width=?,height=? WHERE group_id=?").run(x, y, width, height, groupId);
        } else {
            this._dbInfo.db.prepare("INSERT INTO storyline_group_positions (group_id,x,y,width,height) VALUES (?,?,?,?,?)").run(groupId, x, y, width, height);
        }
    }
}
