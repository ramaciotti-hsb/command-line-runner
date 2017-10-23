import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import { shell } from 'electron'
import path from 'path'

export default class DocumentationEdit extends Component {

    itemInputChange (key, event) {
        this.props.updateItem(key, event.target.value)
    }

    render () {
        return (
            <div className='panel documentation'>
                <div className='header'><input type='text' value={this.props.title} onChange={this.itemInputChange.bind(this, 'title')}/></div>
                <div className='panel-inner'>
                    <div className='command-actions'>
                        <div className='save' onClick={this.props.cancelEditing.bind(null, this.props.id)}>
                            <span className="lnr lnr-checkmark-circle"></span>
                            Save
                        </div>
                        <div className='cancel' onClick={this.props.saveEditing.bind(null, this.props.id)}>
                            <span className="lnr lnr-cross-circle"></span>
                            Cancel
                        </div>
                    </div>
                    <textarea className='body edit' placeholder={'Write documentation here using Markdown.'} value={this.props.body} onChange={this.itemInputChange.bind(this, 'body')} />
                </div>
            </div>
        )
    }
}